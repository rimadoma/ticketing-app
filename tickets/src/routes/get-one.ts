import type { FastifyInstance } from 'fastify';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds, NotFoundError } from '@mahonen_consulting_zlc/common';
import { type TicketParams, ticketParamsSchema } from './ticket-schema.js';

export async function getOneTicketRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get<{ Params: TicketParams }>('/api/tickets/:id', { schema: ticketParamsSchema },
        async (request, reply) => {
            let ticket;
            try {
                ticket = await TicketModel.findById(request.params.id);
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }
            if (!ticket) throw new NotFoundError();
            return reply.code(200).send(ticket);
        });
}
