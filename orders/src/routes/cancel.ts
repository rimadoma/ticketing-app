import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { OrderModel, OrderStatus } from '../models/order.js';
import { AppError, AppErrorIds, BadRequestError, NotFoundError } from '@mahonen_consulting_zlc/common';
import { type OrderParams, orderParamsSchema } from './order-schema.js';
import { orderCancelledPublisher } from '../event-bus/order-cancelled-publisher.js';

export async function cancelOrderRoute(fastify: FastifyInstance): Promise<void> {
    fastify.delete<{ Params: OrderParams }>('/api/orders/:id', { schema: orderParamsSchema },
        async (request, reply) => {
            let order;
            try {
                order = await OrderModel.findOne({ _id: request.params.id, userId: request.currentUser!.id });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }
            if (!order) throw new NotFoundError();

            if (order.status === OrderStatus.Complete) {
                throw new BadRequestError('Cannot cancel a completed order');
            }

            // Don't need to do anything if the order's already cancelled
            if (order.status !== OrderStatus.Cancelled) {
                const ticketId = (order.ticket as mongoose.Types.ObjectId).toHexString();

                // Cancel order
                order.status = OrderStatus.Cancelled;
                order.version = order.version + 1;
                try {
                    await order.save();
                } catch (err) {
                    throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
                }

                // Publish cancellation
                try {
                    await orderCancelledPublisher.publish({
                        id: order.id,
                        userId: order.userId,
                        status: OrderStatus.Cancelled,
                        ticketId,
                        expiresAt: order.expiresAt.toISOString(),
                        version: order.version,
                    });
                } catch (err) {
                    // TODO: outbox pattern — event may be lost on publish failure
                    console.error('Failed to publish order.cancelled event', err);
                }
            }

            return reply.code(200).send(order);
        });
}
