import type amqp from 'amqplib';
import { Listener, Routes, orderSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { OrderCreatedEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';
import { ticketUpdatedPublisher } from './ticket-updated-publisher.js';

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
    protected readonly route = Routes.ORDER_CREATED;
    protected readonly schema = orderSchema;
    protected readonly serviceName = 'tickets';

    protected async onMessage(data: OrderCreatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let ticket;
        try {
            ticket = await TicketModel.findOneAndUpdate(
                { _id: data.ticket.id },
                { $set: { reservingOrderId: data.id }, $inc: { version: 1 } },
                { returnDocument: 'after' },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }

        if (!ticket) {
            console.error(`order.created event references unknown ticket ${data.ticket.id}`);
            return;
        }

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

export const orderCreatedListener = new OrderCreatedListener();
