import { Publisher, Routes, type OrderCreatedEvent } from '@mahonen_consulting_zlc/common';

export class OrderCreatedPublisher extends Publisher<OrderCreatedEvent> {
    protected readonly route = Routes.ORDER_CREATED;
}

export const orderCreatedPublisher = new OrderCreatedPublisher();
