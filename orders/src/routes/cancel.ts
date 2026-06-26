import type { FastifyInstance } from 'fastify';
import { OrderModel } from '../models/order.js';
import { AppError, AppErrorIds, NotFoundError } from '@mahonen_consulting_zlc/common';
import { type OrderParams, orderParamsSchema } from './order-schema.js';

export async function cancelOrderRoute(fastify: FastifyInstance): Promise<void> {
    fastify.delete<{ Params: OrderParams }>('/api/orders/:id', { schema: orderParamsSchema },
        async (request, reply) => {
            let result;
            try {
                result = await OrderModel.deleteOne({ _id: request.params.id, userId: request.currentUser!.id });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }
            if (result.deletedCount === 0) throw new NotFoundError();

            return reply.code(204).send();
        });
}
