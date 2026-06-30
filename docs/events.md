# Event flow

| Event | Published by | Consumed by |
|---|---|---|
| `ticket.created` | tickets | orders |
| `ticket.updated` | tickets | orders |
| `order.created` | orders | tickets, expiration |
| `order.cancelled` | orders | tickets |
| `expiration.complete` | expiration | orders |
