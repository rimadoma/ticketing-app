import type amqp from 'amqplib';
import { Listener, Routes, orderCancelledSchema } from '@mahonen_consulting_zlc/common';
import type { OrderCancelledEvent } from '@mahonen_consulting_zlc/common';

export class OrderCancelledListener extends Listener<OrderCancelledEvent> {
    protected readonly route = Routes.ORDER_CANCELLED;
    protected readonly schema = orderCancelledSchema;
    protected readonly serviceName = 'payments';

    protected async onMessage(_data: OrderCancelledEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        // TODO: skip charging cancelled orders
    }
}

export const orderCancelledListener = new OrderCancelledListener();
