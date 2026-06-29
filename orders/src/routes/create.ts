import type { FastifyInstance } from 'fastify';
import { OrderModel, OrderStatus } from '../models/order.js';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds, BadRequestError, NotFoundError } from '@mahonen_consulting_zlc/common';
import { type OrderBody, orderBodySchema } from './order-schema.js';
import { orderCreatedPublisher } from '../event-bus/order-created-publisher.js';

const EXPIRY_MS = 15 * 60 * 1000;

export async function createOrderRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: OrderBody }>('/api/orders', { schema: orderBodySchema },
        async (request, reply) => {
            let ticket;
            try {
                ticket = await TicketModel.findById(request.body.ticketId);
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }

            if (!ticket) {
                throw new NotFoundError();
            } else if (await ticket.isReserved()) {
                // Also checks whether the user themselves has already reserved the ticket
                throw new BadRequestError("The ticket is already reserved");
            }

            const expiresAt = new Date(Date.now() + EXPIRY_MS);
            let order;
            try {
                order = await OrderModel.create({
                    userId: request.currentUser!.id,
                    status: OrderStatus.Created,
                    ticket,
                    expiresAt,
                    version: 1
                });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }

            try {
                await orderCreatedPublisher.publish({
                    id: order.id,
                    userId: order.userId,
                    status: OrderStatus.Created,
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
                console.error('Failed to publish order.created event', err);
            }

            return reply.code(201).send(order);
        });
}

