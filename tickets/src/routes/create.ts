import type { FastifyInstance } from 'fastify';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import { type TicketBody, ticketBodySchema } from './ticket-schema.js';

export async function createTicketRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: TicketBody }>('/api/tickets', { schema: ticketBodySchema },
        async (request, reply) => {
            const { title, price } = request.body;
            let ticket;
            try {
                ticket = await TicketModel.create({ title, price, userId: request.currentUser!.id });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }
            return reply.code(201).send(ticket);
        });
}
