import type amqp from 'amqplib';
import { Listener, Routes, orderSchema } from '@mahonen_consulting_zlc/common';
import type { OrderCreatedEvent } from '@mahonen_consulting_zlc/common';
import { expirationQueue } from '../scheduling/expiration-queue.js';

class OrderCreatedListener extends Listener<OrderCreatedEvent> {
    protected readonly route = Routes.ORDER_CREATED;
    protected readonly schema = orderSchema;
    protected readonly serviceName = 'expiration';

    protected async onMessage(data: OrderCreatedEvent['data'], _msg: amqp.ConsumeMessage): Promise<void> {
        const delay = Math.max(0, new Date(data.expiresAt).getTime() - Date.now());
        await expirationQueue.add(
            'expiration-complete',
            { orderId: data.id },
            // jobId deduplicates redelivered messages while the job is still pending.
            // If expiresAt ever changes on an existing order, the old job would fire at the
            // wrong time — remove + re-add (or job.changeDelay()) would be needed.
            { delay, jobId: data.id },
        );
        console.log(`Expiration scheduled for order ${data.id} in ${Math.round(delay / 1000)}s`);
    }
}

export const orderCreatedListener = new OrderCreatedListener();
