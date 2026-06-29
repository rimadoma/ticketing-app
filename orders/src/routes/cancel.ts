import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { OrderModel, OrderStatus } from '../models/order.js';
import { AppError, AppErrorIds, NotFoundError } from '@mahonen_consulting_zlc/common';
import { type OrderParams, orderParamsSchema } from './order-schema.js';
import { orderCancelledPublisher } from '../event-bus/order-cancelled-publisher.js';
import { isDocument } from '@typegoose/typegoose';

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

            // Don't need to do anything if the order's already cancelled
            if (order.status !== OrderStatus.Cancelled) {
                if (!isDocument(order.ticket)) {
                    // TODO: reconsider cancel event schema strictness — allowing only ticketId would
                    //       remove this dependency on the ticket document being present.
                    const ticketId = (order.ticket as mongoose.Types.ObjectId).toString();
                    console.error(`Data integrity violation: ticket ${ticketId} not found for order ${order._id.toString()}`);
                    // TODO consider new AppError type
                    throw new Error('Corrupt data');
                }

                const ticket = order.ticket;

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
                        ticket: {
                            id: ticket.id,
                            price: {
                                amount: ticket.price.amount.toString(),
                                currency: ticket.price.currency,
                            },
                        },
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
