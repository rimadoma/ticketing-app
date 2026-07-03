import { vi } from 'vitest';
import type amqp from 'amqplib';
import type { AmqpConnectionManager } from 'amqp-connection-manager';

/**
 * A fake `amqp-connection-manager` connection for exercising Publisher / Listener
 * without a real broker.
 *
 * The one confusing thing this mirrors: the library splits work across TWO objects.
 *
 *   1. `connection.createChannel({ setup })` returns a **ChannelWrapper**. Our code
 *      calls the per-message actions on it: `ack` / `nack` / `publish` / `close`.
 *   2. That `setup` callback is later handed a **raw ConfirmChannel**, on which our
 *      code does the one-time topology declaration: `assertExchange` / `assertQueue`
 *      / `bindQueue` / `consume`.
 *
 * So in tests: assert topology calls against `rawChannel`, and per-message calls
 * against `wrapper`. The real library runs `setup` once the channel connects; we
 * run it when the code awaits `waitForConnect()` -- the next thing connect() does.
 */
export function buildFakeConnection() {
    // Captured from `consume` so a test can push a message through the handler.
    let consumeCallback: ((msg: amqp.ConsumeMessage) => void) | undefined;

    // Raw channel -- receives the one-time topology setup.
    const rawChannel = {
        assertExchange: vi.fn().mockResolvedValue(undefined),
        assertQueue: vi.fn().mockResolvedValue(undefined),
        bindQueue: vi.fn().mockResolvedValue(undefined),
        consume: vi.fn((_queue: string, callback: (msg: amqp.ConsumeMessage) => void) => {
            consumeCallback = callback;
            return Promise.resolve();
        }),
    };

    // Wrapper -- receives the per-message actions.
    const wrapper = {
        ack: vi.fn(),
        nack: vi.fn(),
        publish: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        waitForConnect: vi.fn(),
    };

    const connection = {
        createChannel: vi.fn(({ setup }: { setup: (channel: unknown) => Promise<void> }) => {
            // Defer setup to waitForConnect(), mirroring the real connect flow.
            wrapper.waitForConnect.mockImplementation(() => setup(rawChannel));
            return wrapper;
        }),
    };

    return {
        connection: connection as unknown as AmqpConnectionManager,
        rawChannel,
        wrapper,
        // Simulate the broker delivering a message to the registered consumer.
        deliver: (message: amqp.ConsumeMessage) => consumeCallback!(message),
    };
}

/** A valid `ticket.created` payload; pass overrides to build invalid variants. */
export function buildTicketData(overrides: object = {}) {
    return {
        id: '507f1f77bcf86cd799439011',
        title: 'Concert Ticket',
        price: { amount: '49.99', currency: 'EUR' },
        userId: 'user-abc',
        version: 1,
        reservingOrderId: null,
        ...overrides,
    };
}

/** Wrap a payload as a broker message (JSON in a Buffer), the way amqplib delivers it. */
export function buildMessage(data: object): amqp.ConsumeMessage {
    return { content: Buffer.from(JSON.stringify(data)) } as amqp.ConsumeMessage;
}
