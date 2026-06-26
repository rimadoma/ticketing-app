import { Publisher, Routes, type OrderCancelledEvent } from '@mahonen_consulting_zlc/common';

export class OrderCancelledPublisher extends Publisher<OrderCancelledEvent> {
    protected readonly route = Routes.ORDER_CANCELLED;
}

export const orderCancelledPublisher = new OrderCancelledPublisher();
