import type { FastifyInstance } from 'fastify';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds } from '@mahonen_consulting_zlc/common';
import { type TicketBody, ticketBodySchema } from './ticket-schema.js';
import { ticketCreatedPublisher } from '../event-bus/ticket-created-publisher.js';
import { toTicketPayload } from '../event-bus/ticket-payload.js';

export async function createTicketRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: TicketBody }>('/api/tickets', { schema: ticketBodySchema },
        async (request, reply) => {
            const { title, price } = request.body;
            let ticket;
            try {
                ticket = await TicketModel.create({
                    title,
                    price: {
                        amount: price.amount,
                        currency: price.currency,
                    },
                    userId: request.currentUser!.id,
                });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }

            try {
                await ticketCreatedPublisher.publish(toTicketPayload(ticket));
            } catch (err) {
                // TODO: outbox pattern — event may be lost on publish failure
                console.error('Failed to publish ticket.created event', err);
            }

            return reply.code(201).send(ticket);
        });
}
