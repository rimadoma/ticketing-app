import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';

export async function getAllTicketsRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/tickets', async (_request: FastifyRequest, reply: FastifyReply) => {
        let tickets;
        try {
            tickets = await TicketModel.find();
        } catch (err) {
            throw new AppError(err, AppErrorIds.DB_READ_ERROR);
        }
        return reply.code(200).send(tickets);
    });
}
