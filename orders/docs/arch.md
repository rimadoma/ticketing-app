# Orders Service Architecture

## Known Limitations

### No check for ordering your own ticket

The `POST /api/orders` route does not prevent a user from ordering a ticket they listed for sale themselves. The frontend will filter out the user's own tickets from the listing, but this is not enforced in the backend and can be bypassed directly via the API.

The local `Ticket` model has no `userId` field, so there is no ownership information available at order-creation time. To close this gap, the `ticket.created` / `ticket.updated` event payloads would need to include `userId`, the orders service would need to persist it on the local `Ticket` model, and the create route would need an explicit ownership check.
