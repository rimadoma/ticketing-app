import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type mongoose from 'mongoose';
import { AppError, AppErrorIds, BadRequestError, NotFoundError } from '@mahonen_consulting_zlc/common';
import { Order, OrderModel, OrderStatus } from '../models/order.js';
import { PaymentModel } from '../models/payment.js';
import { stripe } from '../stripe.js';
import { paymentCreatedPublisher } from '../event-bus/payment-created-publisher.js';

function toSmallestCurrencyUnit(amount: mongoose.Types.Decimal128): number {
    const [intPart, fracPart = ''] = amount.toString().split('.');
    return parseInt(intPart!, 10) * 100 + parseInt(fracPart.padEnd(2, '0'), 10);
}

const chargeBodySchema = {
    body: z.object({
        paymentMethodId: z.string().regex(/^pm_[a-zA-Z0-9_]+$/),
        orderId: z.hex().length(24),
    }),
};
type ChargeBody = z.infer<typeof chargeBodySchema.body>;

export async function createRoute(fastify: FastifyInstance): Promise<void> {
    fastify.post<{ Body: ChargeBody }>('/api/payments', { schema: chargeBodySchema },
        async (request, reply) => {
            // Find order
            let order: Order | null;
            try {
                order = await OrderModel.findOne({
                    _id: request.body.orderId,
                    userId: request.currentUser!.id,
                });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }

            if (!order) {
                throw new NotFoundError();
            } else if (order.status === OrderStatus.Cancelled) {
                throw new BadRequestError('Cannot charge a cancelled order');
            }

            // Idempotency: skip if the order's already paid
            let existingPayment;
            try {
                existingPayment = await PaymentModel.findOne({ orderId: request.body.orderId });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_READ_ERROR);
            }

            if (existingPayment) {
                console.warn(`Payment already exists for order ${request.body.orderId}`);
                return reply.code(200).send(existingPayment);
            }

            // Create a payment intent with stripe
            const orderId = request.body.orderId;
            let paymentIntent;
            try {
                paymentIntent = await stripe.paymentIntents.create({
                    amount: toSmallestCurrencyUnit(order.price.amount),
                    currency: order.price.currency.toLowerCase(),
                    payment_method: request.body.paymentMethodId,
                    confirm: true,
                    payment_method_types: ['card'],
                    metadata: { orderId },
                },
                    { idempotencyKey: orderId });
            } catch (err) {
                throw new AppError(err, AppErrorIds.STRIPE_API_ERROR);
            }

            if (paymentIntent.status !== 'succeeded') {
                throw new BadRequestError('Payment failed');
            }

            // Persist payment
            try {
                await PaymentModel.create({
                    _id: paymentIntent.id,
                    orderId: order,
                    version: 1,
                });
            } catch (err) {
                throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
            }

            // Publish event
            await paymentCreatedPublisher.publish({
                id: paymentIntent.id,
                orderId,
                version: 1,
                price: {
                    amount: order.price.amount.toString(),
                    currency: order.price.currency,
                },
            });

            // Return payment intent in response
            return reply.code(201).send(paymentIntent);
        });
}
