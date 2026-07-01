// TODO AwaitingPayment not used -- reservation is just an internal flag for tickets to block edits. Remove Created and use AwaitingPayment instead
export enum OrderStatus {
    // When the order has been created, but its ticket hasn't been reserved yet
    Created = 'created',
    // Ticket already reserved, user cancels, or order expires
    Cancelled = 'cancelled',
    // Ticket successfully reserved, payment pending
    AwaitingPayment = 'awaiting-payment',
    // Ticket reserved and paid
    Complete = 'complete'
}