// Usage: node send [exchange] [routingSuffix] [file], e.g. node send tickets upsert src/test-scripts/ticket.json
import amqp from 'amqplib';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function readJsonFile(path: string): string {
    try {
        const content = readFileSync(path, 'utf-8');
        JSON.parse(content);
        return content;
    } catch {
        throw new Error(`File does not contain valid JSON: ${path}`);
    }
}

// Read config & data
const [,, exchange = 'tickets', routingKeySuffix = 'upsert', file = 'src/test-scripts/ticket.json'] = process.argv;
const routingKey = `${exchange}.${routingKeySuffix}`;
const queue = `${routingKey}.queue`;
const data: string = readJsonFile(resolve(process.cwd(), file));

// RabbitMq setup
const connection = await amqp.connect('amqp://localhost:5672');
const channel = await connection.createChannel();
// Ensure exhange stays even if everyone disconnects
await channel.assertExchange(exchange, 'topic', { durable: true });
// Ensure there's a durable queue so that messages persist until consumed
await channel.assertQueue(queue, { durable: true });
// Bind durable queue to the exhange / routingKey to ensure msg persistence
await channel.bindQueue(queue, exchange, routingKey);

// Send
channel.publish(exchange, routingKey, Buffer.from(data), { persistent: true });

// Teardown
await channel.close();
await connection.close();
