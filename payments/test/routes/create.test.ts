import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { OrderStatus } from '@mahonen_consulting_zlc/common';
import { app, createJwtCookie, testInfra } from '../test-utils.js';
import { OrderModel } from '../../src/models/order.js';
import { PaymentModel } from '../../src/models/payment.js';
import { stripe } from '../../src/stripe.js';
import { paymentCreatedPublisher } from '../../src/event-bus/payment-created-publisher.js';

vi.mock('../../src/stripe.js', () => ({
    stripe: {
        paymentIntents: {
            create: vi.fn().mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' }),
        },
    },
}));
vi.mock('../../src/event-bus/payment-created-publisher.js', () => ({
    paymentCreatedPublisher: { publish: vi.fn() },
}));

const ROUTE = '/api/payments';
const VALID_ORDER_ID = 'a'.repeat(24);
const VALID_PAYMENT_METHOD_ID =  'pm_card_visa';

testInfra();

async function createOrder(userId: string, status = OrderStatus.Created) {
    return OrderModel.create({
        userId,
        status,
        price: { amount: '49.99', currency: 'EUR' },
        version: 1,
    });
}

describe('POST /api/payments', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('returns 401 when not authenticated', async () => {
        await request(app.server)
            .post(ROUTE)
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: VALID_ORDER_ID })
            .expect(401);
    });

    it.each([
        { paymentMethodId: '',             orderId: VALID_ORDER_ID },
        { paymentMethodId: 'tok_visa',     orderId: VALID_ORDER_ID },
        { paymentMethodId: 'pm_',          orderId: VALID_ORDER_ID },
        { paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: '' },
        { paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: 'zzz' },
        { paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: 'a'.repeat(25) },
        { paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: 'z'.repeat(24) },
    ])('returns 400 for invalid body %o', async (body) => {
        await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie())
            .send(body)
            .expect(400);
    });

    it('returns 404 when the order does not exist', async () => {
        await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie())
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: new mongoose.Types.ObjectId().toHexString() })
            .expect(404);
    });

    it('returns 404 when the order belongs to another user', async () => {
        const order = await createOrder('other-user');

        await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie('JohnDoe'))
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: order._id.toString() })
            .expect(404);
    });

    it('returns 201 when a new payment is successfully created', async () => {
        const userId = 'JohnDoe';
        const order = await createOrder(userId);

        const response = await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie(userId))
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: order._id.toString() })
            .expect(201);

        expect(response.body).toMatchObject({ id: 'pi_test_123', status: 'succeeded' });
        expect(await PaymentModel.countDocuments()).toBe(1);
        const payment = await PaymentModel.findById('pi_test_123');
        expect(payment).not.toBeNull();
        expect(payment!.orderId.toString()).toBe(order._id.toString());

        expect(vi.mocked(stripe.paymentIntents.create)).toHaveBeenCalledWith(
            {
                amount: 4999,
                currency: 'eur',
                payment_method: VALID_PAYMENT_METHOD_ID,
                confirm: true,
                payment_method_types: ['card'],
                metadata: { orderId: order._id.toString() },
            },
            { idempotencyKey: order._id.toString() },
        );
        expect(vi.mocked(paymentCreatedPublisher.publish)).toHaveBeenCalledWith({
            id: 'pi_test_123',
            orderId: order._id.toString(),
            version: 1,
            price: { amount: '49.99', currency: 'EUR' },
        });
    });

    it('returns 200 with the order has already been paid', async () => {
        const userId = 'JohnDoe';
        const order = await createOrder(userId);
        await PaymentModel.create({ _id: 'pi_existing', orderId: order, version: 1 });

        const response = await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie(userId))
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: order._id.toString() })
            .expect(200);

        expect(response.body).toMatchObject({ id: 'pi_existing' });
        expect(vi.mocked(stripe.paymentIntents.create)).not.toHaveBeenCalled();
        expect(vi.mocked(paymentCreatedPublisher.publish)).not.toHaveBeenCalled();
        expect(await PaymentModel.countDocuments()).toBe(1);
    });

    it('returns 400 when the payment does not succeed', async () => {
        const userId = 'JohnDoe';
        const order = await createOrder(userId);
        vi.mocked(stripe.paymentIntents.create).mockResolvedValueOnce({ id: 'pi_test_456', status: 'requires_action' } as any);

        await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie(userId))
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: order._id.toString() })
            .expect(400);

        expect(vi.mocked(paymentCreatedPublisher.publish)).not.toHaveBeenCalled();
        expect(await PaymentModel.countDocuments()).toBe(0);
    });

    it('returns 500 when Stripe throws', async () => {
        const userId = 'JohnDoe';
        const order = await createOrder(userId);
        vi.mocked(stripe.paymentIntents.create).mockRejectedValueOnce(new Error('Stripe network error'));

        await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie(userId))
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: order._id.toString() })
            .expect(500);

        expect(vi.mocked(paymentCreatedPublisher.publish)).not.toHaveBeenCalled();
        expect(await PaymentModel.countDocuments()).toBe(0);
    });

    it('returns 400 when the order is cancelled', async () => {
        const userId = 'JohnDoe';
        const order = await createOrder(userId, OrderStatus.Cancelled);

        await request(app.server)
            .post(ROUTE)
            .set('Cookie', createJwtCookie(userId))
            .send({ paymentMethodId: VALID_PAYMENT_METHOD_ID, orderId: order._id.toString() })
            .expect(400);

        expect(vi.mocked(paymentCreatedPublisher.publish)).not.toHaveBeenCalled();
        expect(await PaymentModel.countDocuments()).toBe(0);
    });
});
