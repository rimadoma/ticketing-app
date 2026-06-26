import type { FastifyInstance } from 'fastify';
import { OrderModel, OrderStatus } from '../models/order.js';
import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import { type OrderBody, orderBodySchema } from './order-schema.js';

const EXPIRY_MINUTES = 15;

export async function createOrderRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: OrderBody }>('/api/orders', { schema: orderBodySchema },
        async (request, reply) => {
            const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000);
            let order;
            try {
                order = await OrderModel.create({
                    userId: request.currentUser!.id,
                    status: OrderStatus.Pending,
                    ticketId: request.body.ticketId,
                    expiresAt,
                });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }
            return reply.code(201).send(order);
        });
}
