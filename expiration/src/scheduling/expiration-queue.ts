import { Queue } from 'bullmq';
import { connectionOptions } from './redis-connection.js';

export interface Payload {
    orderId: string;
}

export const expirationQueue = new Queue<Payload>('order-expiration', {
    connection: connectionOptions,
});
