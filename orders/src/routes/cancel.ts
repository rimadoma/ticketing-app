import type { FastifyInstance } from 'fastify';
import { OrderModel, OrderStatus } from '../models/order.js';
import { AppError, AppErrorIds, NotFoundError } from '@mahonen_consulting_zlc/common';
import { type OrderParams, orderParamsSchema } from './order-schema.js';

export async function cancelOrderRoute(fastify: FastifyInstance): Promise<void> {
    fastify.delete<{ Params: OrderParams }>('/api/orders/:id', { schema: orderParamsSchema },
        async (request, reply) => {
            let order;
            try {
                order = await OrderModel.findOne({ _id: request.params.id, userId: request.currentUser!.id }).populate('ticket');
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }
            if (!order) throw new NotFoundError();

            try {
                order.status = OrderStatus.Cancelled;
                await order.save();
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }

            return reply.code(200).send(order);
        });
}
