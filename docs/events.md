# Event flow

| Event | Published by | Consumed by |
|---|---|---|
| `ticket.created` | tickets | orders |
| `ticket.updated` | tickets | orders |
| `order.created` | orders | tickets, expiration, payments |
| `order.cancelled` | orders | tickets, payments |
| `expiration.complete` | expiration | orders |
| `payment.created` | payments | orders |
