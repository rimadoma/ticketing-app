import type amqp from 'amqplib';
import { Listener, Routes, paymentSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { PaymentCreatedEvent } from '@mahonen_consulting_zlc/common';
import { OrderModel, OrderStatus } from '../models/order.js';

export class PaymentCreatedListener extends Listener<PaymentCreatedEvent> {
    protected readonly route = Routes.PAYMENT_CREATED;
    protected readonly schema = paymentSchema;
    protected readonly serviceName = 'orders';

    protected async onMessage(data: PaymentCreatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        let result;
        try {
            result = await OrderModel.updateOne(
                { _id: data.orderId, status: { $nin: [OrderStatus.Cancelled, OrderStatus.Complete] } },
                { $set: { status: OrderStatus.Complete }, $inc: { version: 1 } }
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }

        if (result.matchedCount === 0) {
            console.warn(`payment.created for order ${data.orderId}: no update applied — order not found or already cancelled/complete`);
        }
    }
}

export const paymentCreatedListener = new PaymentCreatedListener();
