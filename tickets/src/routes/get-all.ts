import type { FastifyInstance } from 'fastify';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import { type GetAllTicketsQuery, getAllTicketsQuerySchema } from './ticket-schema.js';

export async function getAllTicketsRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get<{ Querystring: GetAllTicketsQuery }>('/api/tickets', { schema: getAllTicketsQuerySchema },
        async (request, reply) => {
            let tickets;
            try {
                const { showReserved } = request.query;
                const filter = showReserved ? {} : { reservingOrderId: null };
                tickets = await TicketModel.find(filter);
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }
            return reply.code(200).send(tickets);
        });
}
