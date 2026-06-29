import { AppError, AppErrorIds, EventBus } from '@mahonen_consulting_zlc/common';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { ticketCreatedPublisher } from './event-bus/ticket-created-publisher.js';
import { ticketUpdatedPublisher } from './event-bus/ticket-updated-publisher.js';

const ENV_VARS = ['JWT_KEY', 'MONGO_URI'];
for (const key of ENV_VARS) {
    if (!process.env[key]) {
        throw new Error(`${key} must be defined`);
    }
}

const _port = 3002;

async function openDbConnection(): Promise<void> {
    try {
        await mongoose.connect(process.env.MONGO_URI!);
    } catch (err) {
        throw new AppError(err, AppErrorIds.DB_CONNECTION_ERROR);
    }
}

async function setupEventBus(): Promise<EventBus> {
    const eventBus = await EventBus.create();
    await eventBus.addPublishers(ticketCreatedPublisher, ticketUpdatedPublisher);
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
console.log(`Tickets listening on ${_port}`);

// Graceful shutdown
const handleSignal =
    () => shutdown()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
process.once('SIGINT', handleSignal);
process.once('SIGTERM', handleSignal);
