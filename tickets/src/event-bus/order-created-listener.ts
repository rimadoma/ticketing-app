import type amqp from 'amqplib';
import { Listener, Routes, orderSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { OrderCreatedEvent } from '@mahonen_consulting_zlc/common';
import { TicketModel } from '../models/ticket.js';

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
    protected readonly route = Routes.ORDER_CREATED;
    protected readonly schema = orderSchema;
    protected readonly serviceName = 'tickets';

    protected async onMessage(data: OrderCreatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let result;
        try {
            result = await TicketModel.updateOne(
                { _id: data.ticket.id },
                { $set: { reservingOrderId: data.id } },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }

        if (result.matchedCount === 0) {
            console.error(`order.created event references unknown ticket ${data.ticket.id}`);
        }
    }
}

export const orderCreatedListener = new OrderCreatedListener();
