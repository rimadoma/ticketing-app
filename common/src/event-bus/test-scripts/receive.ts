// Usage: node receive [exchange] [routingSuffix], e.g. node receive tickets upsert
import amqp from 'amqplib';

const [, , exchange = 'tickets', routingKeySuffix = 'upsert'] = process.argv;
const routingKey = `${exchange}.${routingKeySuffix}`;
const queue = `${routingKey}.queue`;

const connection = await amqp.connect('amqp://localhost:5672');
const channel = await connection.createChannel();
await channel.assertExchange(exchange, 'topic', { durable: true });
await channel.assertQueue(queue, { durable: true });
await channel.bindQueue(queue, exchange, routingKey);

async function shutDown(): Promise<void> {
        await channel.close();
        await connection.close();
        console.log('Byesies');
        process.exit(0);
}

async function receiveLoop(): Promise<void> {
    console.log("Commencing consuming...")
    await channel.consume(
        queue,
        (message) => {
            if (message) {
                console.log(`Got message:\n${message.content.toString()}`);
            }
            else console.warn('Consumer cancelled');
        },
        { noAck: true },
    );

    process.once('SIGINT', () => shutDown());
    process.once('SIGTERM', () => shutDown());
};

receiveLoop();