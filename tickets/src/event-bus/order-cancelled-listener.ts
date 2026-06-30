import type amqp from 'amqplib';
import { Listener, Routes, orderSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { OrderCancelledEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';
import { ticketUpdatedPublisher } from './ticket-updated-publisher.js';

export class OrderCancelledListener extends Listener<OrderCancelledEvent> {
    protected readonly route = Routes.ORDER_CANCELLED;
    protected readonly schema = orderSchema;
    protected readonly serviceName = 'tickets';

    // TODO: if order.cancelled never arrives, the ticket stays reserved forever.
    protected async onMessage(data: OrderCancelledEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let ticket;
        try {
            // Only cancel if the latest reservation is from this order (messages might arrive out of order)
            ticket = await TicketModel.findOneAndUpdate(
                { _id: data.ticket.id, reservingOrderId: data.id },
                { $unset: { reservingOrderId: '' }, $inc: { version: 1 } },
                { returnDocument: 'after' },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }

        // Either the ticket didn't exist, or it wasn't reserved by this order. Pretty harmless either way.
        if (!ticket) return;

        try {
            await ticketUpdatedPublisher.publish({
                id: ticket.id,
                title: ticket.title,
                price: {
                    amount: ticket.price.amount.toString(),
                    currency: ticket.price.currency,
                },
                userId: ticket.userId,
                version: ticket.version,
                reservingOrderId: ticket.reservingOrderId,
            });
        } catch (err) {
            // TODO: outbox pattern — event may be lost on publish failure
            console.error('Failed to publish ticket.updated event', err);
        }
    }
}

export const orderCancelledListener = new OrderCancelledListener();
