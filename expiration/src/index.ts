import { EventBus } from '@mahonen_consulting_zlc/common';
import { expirationCompletePublisher } from './event-bus/expiration-complete-publisher.js';
import { orderCreatedListener } from './event-bus/order-created-listener.js';
import { expirationQueue } from './scheduling/expiration-queue.js';
import { expirationWorker } from './scheduling/expiration-worker.js';

async function setupEventBus(): Promise<EventBus> {
    const eventBus = await EventBus.create();
    await eventBus.addPublishers(expirationCompletePublisher);
    await eventBus.addListeners(orderCreatedListener);
    return eventBus;
}

async function shutdown(): Promise<void> {
    await expirationWorker.close();
    await expirationQueue.close();
    await eventBus.close();
}

const eventBus = await setupEventBus();
console.log('Expiration service started');

const handleSignal =
    () => shutdown()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);
