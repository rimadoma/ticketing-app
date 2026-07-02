# Payments Service Architecture

## Stripe Integration

### Payment Intents over the legacy Charges API

The route accepts a `paymentMethodId` (`pm_xxx`) rather than a token (`tok_xxx`). Tokens belong to the legacy Charges API, which Stripe discourages for new integrations. The Payment Intents API is the modern replacement because it supports Strong Customer Authentication (SCA) and 3D Secure — regulatory requirements in the EU — without extra work from the integration.

In both approaches the backend never sees raw card data. Stripe.js on the frontend handles card collection and produces either a token or a payment method ID; only that opaque reference travels to the backend.

### Server-side confirmation — no webhook

The PaymentIntent is created with `confirm: true`, which makes the Stripe API call synchronous: it does not return until the payment attempt has completed. The returned object's `status` field is checked immediately — `succeeded` means the money moved, anything else is treated as a failure.

This avoids the webhook-based alternative, where the backend would create an intent, hand a `client_secret` back to the frontend, let the frontend confirm, and then wait for a `payment_intent.succeeded` webhook before persisting the charge. That flow is necessary when 3D Secure redirects are required, but adds significant complexity: a second HTTP round trip, a public webhook endpoint, signature verification, and asynchronous state reconciliation.

For this learning project, which only accepts cards and has no SCA requirements, the synchronous confirm is sufficient and keeps the implementation to a single request/response cycle.

### Idempotency

A given order must never be charged twice, even if the client retries the request. Three layers guard against this:

1. **Pre-Stripe existence check** — before calling Stripe, the route looks up an existing `Payment` for the order (`PaymentModel.findOne({ orderId })`). If one exists, it short-circuits with `200` and the existing payment, never touching Stripe.
2. **Stripe idempotency key** — the PaymentIntent is created with `{ idempotencyKey: orderId }`. If a retry slips past the check above (e.g. two concurrent requests), Stripe returns the original PaymentIntent instead of charging again.
3. **PaymentIntent id as `_id`** — the persisted `Payment` uses the Stripe PI id (`pi_xxx`) as its MongoDB `_id`. A duplicate PI can't be inserted twice, so the database is the final backstop.

### Known limitations

- Only card payments are accepted (`payment_method_types: ['card']`). Other payment methods (iDEAL, Klarna, etc.) would require the webhook flow to handle redirects.
- No minimum charge amount validation. Stripe requires a minimum of $0.50 (or equivalent) — amounts below this will be rejected by Stripe at runtime.
- Currency support is not validated. Stripe does not support all ISO 4217 currency codes; unsupported currencies will be rejected at runtime.
- Doesn't support any currencies that don't divide into sub-units of 100, e.g. JPY
- No Stripe receipt emails. The `receipt_email` field on `paymentIntents.create()` could be set to the buyer's email, but the payments service has no access to user data — it would need to call the auth service directly to look up the user by `userId`.
