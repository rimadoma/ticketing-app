import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

const port = 3001;

const endings = ['.', '!', '?', '...', '!!', '?!', '!?', ' <3', ' :3'];

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)]!;
}

const LETTERHEAD = `Mähönen Consulting ZLC
Hedgehog as a Service (HaaS)
---`;

function invoice(text: string): string {
    const count = (text.match(/snuffle/gi) ?? []).length;
    const price = (count * 0.1).toFixed(2);
    return `Consultation fee: £${price} for ${count} snuffles, but don't worry as the hedgehog doesn't know what money is.`;
}

function consult(): string {
    const novella = Math.random() <= 0.01;
    const sentenceCount = novella ? 1000 : Math.floor(Math.random() * 4) + 1;
    const sentences: string[] = [];

    for (let i = 0; i < sentenceCount; i++) {
        const wordCount = Math.floor(Math.random() * 5) + 1;
        const parts: string[] = ["Snuffle"];

        for (let j = 1; j < wordCount; j++) {
            parts.push("snuffle");
        }

        sentences.push(parts.join(' ') + pick(endings));
    }

    const text = sentences.join(' ');
    return `${LETTERHEAD}\n\n${text}\n\n${invoice(text)}`;
}

async function routes(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/hedgehog/consult', async (_request, reply) => {
        return reply.code(200).send(consult());
    });
}

async function createApp(): Promise<FastifyInstance> {
    const instance = Fastify();
    instance.register(routes);
    await instance.listen({ port, host: '0.0.0.0' });
    return instance;
}

await createApp();
console.log(`Listening on ${port}`);
