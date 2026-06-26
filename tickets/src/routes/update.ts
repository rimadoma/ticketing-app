import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';
import { TicketModel } from '../models/ticket.js';
import { AppError, AppErrorIds, NotFoundError, ForbiddenError } from '@mahonen_consulting_zlc/common';
import { type TicketBody, type TicketParams, ticketBodySchema, ticketParamsSchema } from './ticket-schema.js';
import { ticketUpdatedPublisher } from '../event-bus/ticket-updated-publisher.js';

export async function updateTicketRoute(fastify: FastifyInstance): Promise<void> {
    fastify.put<{ Params: TicketParams; Body: TicketBody }>('/api/tickets/:id',
        { schema: { ...ticketParamsSchema, ...ticketBodySchema } },
        async (request, reply) => {
            // find ticket from DB
            let ticket;
            try {
                ticket = await TicketModel.findById(request.params.id);
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }
            if (!ticket) throw new NotFoundError();

            // Check user is authorised
            if (ticket.userId !== request.currentUser!.id) {
                throw new ForbiddenError('Not authorized to edit this ticket');
            }

            // Update ticket
            const { title, price } = request.body;
            ticket.title = title;
            ticket.price.amount = mongoose.Types.Decimal128.fromString(price.amount);
            ticket.price.currency = price.currency;
            ticket.markModified('price');
            try {
                await ticket.save();
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }

            // Publish event
            try {
                await ticketUpdatedPublisher.publish({
                    _id: ticket.id,
                    title: ticket.title,
                    price: {
                        amount: ticket.price.amount.toString(),
                        currency: ticket.price.currency,
                    },
                    userId: ticket.userId,
                });
            } catch (err) {
                // TODO: outbox pattern — event may be lost on publish failure
                console.error('Failed to publish ticket.updated event', err);
            }

            return reply.code(200).send(ticket);
        });
}
