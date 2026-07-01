import { Publisher, Routes, type PaymentCreatedEvent } from '@mahonen_consulting_zlc/common';

export class PaymentCreatedPublisher extends Publisher<PaymentCreatedEvent> {
    protected readonly route = Routes.PAYMENT_CREATED;
}

export const paymentCreatedPublisher = new PaymentCreatedPublisher();
