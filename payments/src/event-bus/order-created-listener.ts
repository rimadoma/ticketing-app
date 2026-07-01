import mongoose from 'mongoose';
import type amqp from 'amqplib';
import { Listener, Routes, orderSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { OrderCreatedEvent } from '@mahonen_consulting_zlc/common';
import { OrderModel } from '../models/order.js';

export class OrderCreatedListener extends Listener<OrderCreatedEvent> {
    protected readonly route = Routes.ORDER_CREATED;
    protected readonly schema = orderSchema;
    protected readonly serviceName = 'payments';

    protected async onMessage(data: OrderCreatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        try {
            await OrderModel.updateOne(
                { _id: new mongoose.Types.ObjectId(data.id) },
                { $setOnInsert: {
                    userId: data.userId,
                    status: data.status,
                    price: data.ticket.price,
                    version: data.version,
                }},
                { upsert: true },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }
    }
}

export const orderCreatedListener = new OrderCreatedListener();
