export enum OrderStatus {
    // When the order has been created, but its ticket hasn't been reserved yet
    Created = 'created',
    // 
    Cancelled = 'cancelled',
    AwaitingPayment = 'awaiting-payment',
    Complete = 'complete'
}