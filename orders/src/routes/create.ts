import type { FastifyInstance } from 'fastify';
import { OrderModel, OrderStatus } from '../models/order.js';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds, BadRequestError, NotFoundError } from '@mahonen_consulting_zlc/common';
import { type OrderBody, orderBodySchema } from './order-schema.js';

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
                });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }
            return reply.code(201).send(order);
        });
}

