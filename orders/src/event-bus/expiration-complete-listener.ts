import type amqp from 'amqplib';
import mongoose from 'mongoose';
import { Listener, Routes, expirationSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { ExpirationCompleteEvent } from '@mahonen_consulting_zlc/common';
import { OrderModel, OrderStatus } from '../models/order.js';
import { orderCancelledPublisher } from './order-cancelled-publisher.js';

export class ExpirationCompleteListener extends Listener<ExpirationCompleteEvent> {
    protected readonly route = Routes.EXPIRATION_COMPLETE;
    protected readonly schema = expirationSchema;
    protected readonly serviceName = 'orders';

    protected async onMessage(data: ExpirationCompleteEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let order;
        try {
            order = await OrderModel.findOneAndUpdate(
                { _id: data.orderId, status: { $in: [OrderStatus.Created, OrderStatus.AwaitingPayment] } },
                { $set: { status: OrderStatus.Cancelled }, $inc: { version: 1 } },
                { returnDocument: 'after' },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }

        // Already cancelled or completed, or order not found — nothing to do
        if (!order) return;

        const ticketId = (order.ticket as mongoose.Types.ObjectId).toHexString();

        try {
            await orderCancelledPublisher.publish({
                id: order.id,
                userId: order.userId,
                status: OrderStatus.Cancelled,
                ticketId,
                expiresAt: order.expiresAt.toISOString(),
                version: order.version,
            });
        } catch (err) {
            // TODO: outbox pattern — event may be lost on publish failure
            console.error('Failed to publish order.cancelled event', err);
        }
    }
}

export const expirationCompleteListener = new ExpirationCompleteListener();
