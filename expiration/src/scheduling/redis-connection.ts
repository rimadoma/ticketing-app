const url = new URL(process.env.REDIS_URL ?? 'redis://expiration-redis-service:6379');

export const connectionOptions = {
    host: url.hostname,
    port: Number(url.port) || 6379,
};
