import { AppError, AppErrorIds, EventBus } from '@mahonen_consulting_zlc/common';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { ticketCreatedListener } from './event-bus/ticket-created-listener.js';
import { ticketUpdatedListener } from './event-bus/ticket-updated-listener.js';
import { orderCreatedPublisher } from './event-bus/order-created-publisher.js';
import { orderCancelledPublisher } from './event-bus/order-cancelled-publisher.js';

const ENV_VARS = ['JWT_KEY', 'MONGO_URI'];
for (const key of ENV_VARS) {
    if (!process.env[key]) {
        throw new Error(`${key} must be defined`);
    }
}

const _port = 3003;

async function openDbConnection(): Promise<void> {
    try {
        await mongoose.connect(process.env.MONGO_URI!);
    } catch (err) {
        throw new AppError(err, AppErrorIds.DB_CONNECTION_ERROR);
    }
}

async function setupEventBus(): Promise<EventBus> {
    const eventBus = await EventBus.create();
    await eventBus.addListeners(ticketCreatedListener, ticketUpdatedListener);
    await eventBus.addPublishers(orderCreatedPublisher, orderCancelledPublisher);
    return eventBus;
}

async function shutdown(): Promise<void> {
    await app.close();
    await eventBus.close();
    await mongoose.disconnect();
}

const app = await createApp();
await openDbConnection();
const eventBus = await setupEventBus();

await app.listen({ port: _port, host: "0.0.0.0" });
console.log(`Orders listening on ${_port}`);

const handleSignal =
    () => shutdown()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);
