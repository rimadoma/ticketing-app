# Event flow

| Event | Published by | Consumed by |
|---|---|---|
| `ticket.created` | tickets | orders |
| `ticket.updated` | tickets | orders |
| `order.created` | orders | tickets |
| `order.cancelled` | orders | tickets |
