import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { OrderModel } from '../models/order.js';
import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';

export async function getAllOrdersRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/orders', async (request: FastifyRequest, reply: FastifyReply) => {
        let orders;
        try {
            orders = await OrderModel.find({ userId: request.currentUser!.id }).populate('ticket');
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_READ_ERROR);
        }
        return reply.code(200).send(orders);
    });
}
