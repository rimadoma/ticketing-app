import { Worker } from 'bullmq';
import { expirationCompletePublisher } from '../event-bus/expiration-complete-publisher.js';
import { connectionOptions } from './redis-connection.js';
import type { Payload } from './expiration-queue.js';

export const expirationWorker = new Worker<Payload>(
    'order-expiration',
    async (job) => {
        console.log(`Expiration fired for order ${job.data.orderId}`);
        await expirationCompletePublisher.publish({ orderId: job.data.orderId, version: 1 });
    },
    { connection: connectionOptions },
);

expirationWorker.on('failed', (job, err) => {
    // TODO: outbox pattern — event may be lost on publish failure
    console.error(`Expiration job ${job?.id} failed:`, err);
});
