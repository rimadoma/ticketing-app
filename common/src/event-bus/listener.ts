import amqp from 'amqplib';

export default abstract class Listener {
    connection: amqp.ChannelModel | null = null;
    channel: amqp.Channel | null = null;
    abstract exchangeName: string;
    // TODO: make these arrs to support multiple routes
    abstract routingSuffix: string;
    queueName: string | null = null;

    async connect() {
        const routingKey = `${this.exchangeName}.${this.routingSuffix}`;
        this.queueName = `${routingKey}.queue`;
        
        this.connection = await amqp.connect('amqp://rabbitmq-service');

        //TODO: ack wait 5000 ms, manual acks? 

        this.channel = await this.connection.createChannel();
        await this.channel.assertExchange(this.exchangeName, 'topic', { durable: true });
        await this.channel.assertQueue(this.queueName, { durable: true });
        await this.channel.bindQueue(this.queueName, this.exchangeName, routingKey);
    }

    async listen(): Promise<void> {
        if (!this.channel || !this.queueName) {
            return;
        }

        await this.channel.consume(
            this.queueName,
            (message) => this.onMessage(message),
            { noAck: false },
        );
    }

    abstract onMessage(message: amqp.ConsumeMessage | null): void

    async close(): Promise<void> {
        if (this.channel) {
            await this.channel.close();
        }

        if (this.connection) {
            await this.connection.close();
        }
    }
}