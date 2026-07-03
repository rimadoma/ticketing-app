/**
 * How long an unconsumed message survives in a pre-declared queue before
 * RabbitMQ drops it. Applied to every queue we assert — both here (topology
 * bootstrap) and in the listener's own assertQueue — so the two declarations
 * carry identical arguments and never collide with a PRECONDITION_FAILED.
 */
export const QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const QUEUE_ARGS: Record<string, unknown> = { 'x-message-ttl': QUEUE_TTL_MS };

export interface QueueTopology {
    readonly service: string;
    readonly exchange: string;
    readonly route: string;
    readonly queue: string;
}

/**
 * Parses the queue topology from the `EVENT_BUS_TOPOLOGY` env var: a
 * semicolon-separated list of `service,exchange,suffix` rows, e.g.
 * `orders,ticket,created;orders,ticket,updated`. Each queue's full identity is
 * reconstructed by joining fields:
 *   route = `${exchange}.${suffix}`         e.g. order.created
 *   queue = `${service}.${route}`           e.g. expiration.order.created
 *
 * Returns an empty array when the var is unset, empty, or entirely malformed —
 * the caller treats that as "no topology to assert" and falls back to
 * listeners creating their own queues on connect.
 */
export function loadTopology(raw: string | undefined = process.env.EVENT_BUS_TOPOLOGY): QueueTopology[] {
    if (!raw) return [];

    const topology: QueueTopology[] = [];
    for (const rawRow of raw.split(';')) {
        const row = rawRow.trim();
        if (row === '') continue;

        const parts = row.split(',').map((part) => part.trim());
        const service = parts[0];
        const exchange = parts[1];
        const suffix = parts[2];
        if (parts.length !== 3 || !service || !exchange || !suffix) {
            console.warn(`[event-bus] skipping malformed topology row: "${rawRow}"`);
            continue;
        }

        const route = `${exchange}.${suffix}`;
        topology.push({ service, exchange, route, queue: `${service}.${route}` });
    }
    return topology;
}
