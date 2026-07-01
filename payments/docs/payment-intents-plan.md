# Stripe Payment Intents Implementation Plan

## Why Payment Intents, not Tokens

The current route body has a `token` field — that's the legacy Charges API (`tok_xxx`). Stripe recommends Payment Intents for all new integrations because they support 3D Secure (SCA) and let Stripe inject an authentication step before money moves.

**Both approaches keep the backend away from raw card data.** Only Stripe.js on the frontend ever touches card numbers.

| | Legacy Tokens | Payment Intents |
|---|---|---|
| Frontend sends | `tok_xxx` (from `stripe.createToken()`) | `pm_xxx` (from `stripe.createPaymentMethod()`) |
| Backend does | `stripe.charges.create({ source: token })` | `stripe.paymentIntents.create({ payment_method, confirm: true })` |
| 3DS support | No | Yes |

For our app we use **server-side confirmation**: create the intent with `confirm: true` in a single backend call. No webhook needed. The frontend sends a `paymentMethodId` instead of a `token`.

> **Note:** This document was the pre-implementation plan. It has been updated to reflect what was actually built — see `arch.md` for the architecture decision record.

> **Alternative (canonical Stripe flow):** create the intent on the backend → return `client_secret` → frontend calls `stripe.confirmCardPayment(clientSecret, { payment_method: { card } })` → backend monitors `payment_intent.succeeded` webhook. This supports 3DS redirects but requires more moving parts. For this learning app, server-side confirm is sufficient.

---

## Flow

```
Frontend                          Backend (payments service)
--------                          --------------------------
stripe.createPaymentMethod()  →   POST /api/payments
  returns pm_xxx                    1. validate order (exists, owned by user,
                                       not cancelled)
                                    2. check for existing Payment (idempotency)
                                       → if found, reply 200 with it
                                    3. stripe.paymentIntents.create({
                                         amount, currency,
                                         payment_method: pm_xxx,
                                         confirm: true,
                                         payment_method_types: ['card'],
                                         metadata: { orderId },
                                       },
                                       { idempotencyKey: orderId })
                                    4. reject if status !== 'succeeded' (400)
                                    5. PaymentModel.create(...)
                                    6. paymentCreatedPublisher.publish(...)
                                    7. reply 201 with the PaymentIntent
```

---

## Changes Required

### 1. `payments/package.json`
Add `stripe` dependency. Run `! npm install stripe` in `payments/`.

### 2. `common/src/errors/app-error-ids.ts`
Add:
```ts
STRIPE_API_ERROR = 6   // stripe.paymentIntents.create() failure
```
Then rebuild and publish common, reinstall in payments.

### 3. `infra/k8s/stripe-secret.yaml` *(new)*
Kubernetes Secret for `STRIPE_KEY`. Apply with actual test/prod key.

### 4. Payments Deployment manifest in `infra/k8s/`
Add `STRIPE_KEY` env var referencing the secret.

### 5. `payments/src/stripe.ts` *(new)*
A module-level singleton so the client is constructed once (and can be mocked wholesale in tests):
```ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_KEY!, {
    apiVersion: Stripe.API_VERSION,
});
```

### 6. `payments/src/index.ts`
- Add `'STRIPE_KEY'` to `ENV_VARS`
- Import `paymentCreatedPublisher` and pass to `eventBus.addPublishers()`

### 7. `payments/src/models/payment.ts` *(new)*
The Stripe PaymentIntent id doubles as the `_id` (natural idempotency), and `orderId` is a `Ref` to the Order rather than a copied string — price details are populated from the order when publishing:
```ts
import mongoose from 'mongoose';
import { prop, getModelForClass, modelOptions, type Ref } from '@typegoose/typegoose';
import { Order } from './order.js';

@modelOptions({ schemaOptions: { versionKey: false, toJSON: { transform(_doc, ret) {
    return { id: ret._id, orderId: ret.orderId, version: ret.version };
} } } })
export class Payment {
    @prop({ type: () => String, required: true })
    public _id!: string;  // Stripe PaymentIntent id (pi_xxx)

    @prop({ ref: () => Order, required: true })
    public orderId!: Ref<Order>;

    @prop({ type: () => mongoose.Schema.Types.Int32, required: true })
    public version!: number;
}

export const PaymentModel = getModelForClass(Payment);
```

### 8. `payments/src/event-bus/payment-created-publisher.ts` *(new)*
```ts
import { Publisher, Routes, type PaymentCreatedEvent } from '@mahonen_consulting_zlc/common';

export class PaymentCreatedPublisher extends Publisher<PaymentCreatedEvent> {
    protected readonly route = Routes.PAYMENT_CREATED;
}
export const paymentCreatedPublisher = new PaymentCreatedPublisher();
```

### 9. `payments/src/routes/create.ts`
**Body schema** — replace `token` with `paymentMethodId`, validating the `pm_` prefix:
```ts
body: z.object({
    paymentMethodId: z.string().regex(/^pm_[a-zA-Z0-9_]+$/),
    orderId: z.hex().length(24),
})
```

**Add a `toSmallestCurrencyUnit` helper** above the route function (pure integer arithmetic — `price.amount` is a string with at most 2 decimal places per its Zod regex, so no floats needed). Named generically since not every currency uses "cents":
```ts
function toSmallestCurrencyUnit(amount: mongoose.Types.Decimal128): number {
    const [intPart, fracPart = ''] = amount.toString().split('.');
    return parseInt(intPart!, 10) * 100 + parseInt(fracPart.padEnd(2, '0'), 10);
}
```

**Fill in the flow** (after the order has been validated as existing, owned by the user, and not cancelled):
```ts
// Idempotency: if a payment already exists, short-circuit before Stripe
const existingPayment = await PaymentModel.findOne({ orderId: request.body.orderId });
if (existingPayment) {
    return reply.code(200).send(existingPayment);
}

// Charge via Stripe (client is the singleton from stripe.ts)
const orderId = request.body.orderId;
let paymentIntent;
try {
    paymentIntent = await stripe.paymentIntents.create(
        {
            amount: toSmallestCurrencyUnit(order.price.amount),
            currency: order.price.currency.toLowerCase(),
            payment_method: request.body.paymentMethodId,
            confirm: true,
            payment_method_types: ['card'],
            metadata: { orderId },
        },
        { idempotencyKey: orderId },
    );
} catch (err) {
    throw new AppError(err, AppErrorIds.STRIPE_API_ERROR);
}

if (paymentIntent.status !== 'succeeded') {
    throw new BadRequestError('Payment failed');
}

// Persist payment (Stripe PI id as _id, orderId as a Ref)
try {
    await PaymentModel.create({
        _id: paymentIntent.id,
        orderId: order,
        version: 1,
    });
} catch (err) {
    throw new AppError(err, AppErrorIds.DB_WRITE_ERROR);
}

// Publish event (price populated from the order)
await paymentCreatedPublisher.publish({
    id: paymentIntent.id,
    orderId,
    version: 1,
    price: {
        amount: order.price.amount.toString(),
        currency: order.price.currency,
    },
});

return reply.code(201).send(paymentIntent);
```

### 10. `payments/test/routes/create.test.ts`
- Replace all `token: 'tok_visa'` → `paymentMethodId: 'pm_card_visa'`
- Replace `token: ''` → `paymentMethodId: ''` in validation matrix
- Mock the local Stripe wrapper (not the `stripe` package) so the singleton isn't constructed, and mock the publisher so no broker connection is needed:
  ```ts
  vi.mock('../../src/stripe.js', () => ({
      stripe: {
          paymentIntents: {
              create: vi.fn().mockResolvedValue({ id: 'pi_test_123', status: 'succeeded' }),
          },
      },
  }));
  vi.mock('../../src/event-bus/payment-created-publisher.js', () => ({
      paymentCreatedPublisher: { publish: vi.fn() },
  }));
  ```
- Cover: 201 happy path (payment persisted + event published), 200 already-paid (no Stripe/publish), 400 payment-not-succeeded, 500 Stripe throws, 400 cancelled order — each asserting no event published where applicable

---

## Verification

```bash
# Unit tests
! npm test   # run from payments/

# Integration (requires cluster + real Stripe test key)
# skaffold dev, then use Stripe test card 4242 4242 4242 4242
# Verify charge document in MongoDB and charge.created event in RabbitMQ
```
