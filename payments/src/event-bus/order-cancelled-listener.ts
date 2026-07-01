import type amqp from 'amqplib';
import { Listener, Routes, orderCancelledSchema, AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import type { OrderCancelledEvent } from '@mahonen_consulting_zlc/common';
import { OrderModel, OrderStatus } from '../models/order.js';

export class OrderCancelledListener extends Listener<OrderCancelledEvent> {
    protected readonly route = Routes.ORDER_CANCELLED;
    protected readonly schema = orderCancelledSchema;
    protected readonly serviceName = 'payments';

    protected async onMessage(data: OrderCancelledEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        try {
            await OrderModel.updateOne(
                {
                    _id: data.id,
                    version: { $lt: data.version },
                    status: { $ne: OrderStatus.Cancelled },
                },
                { $set: { status: OrderStatus.Cancelled, version: data.version } },
            );
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
        }
    }
}

export const orderCancelledListener = new OrderCancelledListener();
