import type amqp from 'amqplib';
import { Listener, Routes, orderSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { OrderCancelledEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';

export class OrderCancelledListener extends Listener<OrderCancelledEvent> {
    protected readonly route = Routes.ORDER_CANCELLED;
    protected readonly schema = orderSchema;
    protected readonly serviceName = 'tickets';

    // TODO: if order.cancelled never arrives, the ticket stays reserved forever.
    protected async onMessage(data: OrderCancelledEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        try {
            // Only cancel if the latest reservation is from this order (messages might arrive out of order)
            await TicketModel.updateOne(
                { _id: data.ticket.id, reservingOrderId: data.id },
                { $unset: { reservingOrderId: '' } },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }
    }
}

export const orderCancelledListener = new OrderCancelledListener();
