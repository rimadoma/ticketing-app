# Ticketing App
An exercise e-commerce app for buying tickets created following the course [Microservices with Node JS and React](https://gofore.udemy.com/course/microservices-with-node-js-and-react/learn/lecture/19565190#overview) on Udemy. There are obvious pieces missing like deleting a ticket or any kind of admin users, because this is just a learning project. 

Key differences from the course:
* Using JS modules
* Vitest instead of Jest
* Fastify instead of Express
* RabbitMQ instead of NATS Streaming
   * common lib hides RabbitMQ details so that services don't know about it
* Mongoose used with typegoose
* Events & requests use zod schemas
* Dropped mongoose-update-if-current lib
* Don't care about skipped events, as long as the incoming event has a newer data version it's fine
* BullMQ instead of Bull for scheduling
* Stripe payment intent instead of tokens

Most of these changes were made because the course is a few years old and some of the tech is out-of-date.

## Services
* Auth - Manages user accounts. Exposes sign-up, sign-in, sign-out, and current-user routes. Issues JWTs stored in cookies; no events published or consumed.
* Tickets - Manages ticket listings. Exposes create, update, and get routes. Publishes `ticket.created` and `ticket.updated`; listens for `order.created` and `order.cancelled` to lock/unlock tickets so a reserved ticket can't be edited.
* Orders - Manages the purchase lifecycle for a ticket. Exposes create, get, and cancel routes. Publishes `order.created` and `order.cancelled`; listens for `ticket.created` and `ticket.updated` to maintain a local copy of ticket details (orders store a denormalised snapshot of the ticket), `payment.created` to mark an order complete once it's paid, and `expiration.complete` to cancel unpaid orders when they time out.
* Expiration - Tracks order expiration. Listens for `order.created`, starts a timer based on the order's `expiresAt`, and always publishes `expiration.complete` when the timer fires. The orders service decides whether to act on it. No HTTP routes. Uses Redis to persist pending timers across restarts.
* Payments - Processes card payments via Stripe Payment Intents. Listens for `order.created` and `order.cancelled`, exposes `POST /api/payments`, and publishes `payment.created` on success.
* Hedgehog Consultancy - A GCP-only easter egg exposing `GET /api/hedgehog/consult`. No DB, no events, no point — it just dispenses (legally non-binding) hedgehog wisdom. Only built and routed in the GCP profile; the local cluster leaves it out.

## Architecture
Backend follows a clean microservice architecture where each app is completely independent. They're deployed separately with no coupling. Most services have their own MongoDB database; expiration uses Redis instead to persist pending timers. In principle services could be implemented in different technologies, but in practice all use Node.js, TypeScript, and Fastify. Data-backed services use MongoDB with Mongoose & Typegoose. Data would probably fit better in a relational DB like PostgreSQL, but following the course with MongoDB.

Frontend (client) is rendered server side with Next.JS. Very rudimentary & janky Web 1.0 UX. 

Apps are containerised with Docker and can be deployed to a Kubernetes cluster running either locally or on GKE (see below). The backend images are dev images for ease of use (they run `tsx` rather than precompiled JS) and could be optimised for prod. The client is the exception: `client/Dockerfile` runs `next dev` for local work, while `client/Dockerfile.prod` (used for GCP) does a real `next build` + `next start`.

See **/docs for more details on individual components.

### Events & concurrency
See [docs/events.md](docs/events.md) for a table of which services publish and consume each event.

The backend microservices communicate with each other only indirectly via an event bus implemented in the common library. They publish events without knowing who's listening to them. Each event must have a predefined type and its data must follow a schema. Both are found in the library. Currently the library uses RabbitMQ to implement the event bus. It has durable queues, which support multiple consumers in a round robin fashion. Messages are only acknowledged after successful processing; on a retriable failure they are nacked and requeued so another consumer instance can retry. Queues persist messages until they're consumed -- even if the RabbitMQ broker goes down -- though an unconsumed message is dropped after a 7-day TTL so an undeployed consumer's queue can't grow forever. What's not supported is replays: you can't bring up a new service that consumes the entire event history.

The full topology — exchanges, queues, and their bindings — is declared at the broker up front: a `definitions.json` (in the `rabbitmq-config` ConfigMap) is loaded at RabbitMQ startup via `load_definitions`, so every queue exists and is bound the moment the broker is ready, before any service connects. This matters because a topic exchange drops any message that routes to no currently-bound queue — so without pre-declared queues, an event published before its consumer had ever started would be lost. With the queues in place from the start, a producer can publish before the consuming service has even booted and the message just waits in the durable queue. Publishers still only assert the exchange (they don't know who's listening), and each listener still asserts and binds its own queue when it connects as a self-sufficient fallback — it's just no longer the only thing standing between a publish and a dropped message.

Services handle concurrency by versioning their data in the DB. Versioning starts from 1 and increments by one on every modification, but the only real constraint is that it's monotonically increasing. An incoming event is written only if it carries newer data (`version > myVersion`); stale data (`version <= myVersion`) is ignored. The guard is enforced as an atomic DB filter on the write itself — never read-then-check-then-write — so concurrent consumer instances can't race and apply the same event twice.

Because every event carries **complete** state rather than a delta, an out-of-order or dropped event doesn't corrupt anything. Events look like `{ balance: 100, v: 1 }`, `{ balance: 120, v: 2 }`, `{ balance: 150, v: 3 }` — not `{ +100, v: 1 }`, `{ +20, v: 2 }`, `{ +30, v: 3 }` — so applying the latest version you've seen always leaves you correct, no matter what arrived in between.

## How to build, deploy & dev

### Standalone locally

Testing frontend (client/) standalone will be a major pain in the bum. I don't recommend it. Also, there are no config files, so you may need to change many hard-coded consts, e.g. cluster URL to localhost. That being said, each service lives in its own directory. The shared library (`common/`) is published to npm as [`@mahonen_consulting_zlc/common`](https://www.npmjs.com/package/@mahonen_consulting_zlc/common) and installed as a regular dependency. To run a service, e.g. auth:

```bash
cd auth
npm install
npm run dev
```

The service will be available at `http://localhost:<port>/<route>`, e.g. auth at `http://localhost:3000/api/users/signup`

To save doing this per service by hand, `scripts/` has helpers that loop over the services: `build-all.sh` (install + build), `test-all.sh` (run every test suite), and `prepare-for-publish.sh <major|minor|patch>` (install, build, and bump the common library's version, ready for `npm publish`).

#### Environment variables

Some services require environment variables that are normally injected by Kubernetes. Set these in your shell before running:

| Variable       | Description                                              |
|----------------|----------------------------------------------------------|
| `JWT_KEY`      | Secret used to sign/verify JWTs — any string works locally |
| `MONGO_URI`    | MongoDB connection string, e.g. `mongodb://localhost:27017/<service>` |
| `RABBITMQ_URL` | RabbitMQ connection string, e.g.`amqp://localhost:5672`  |
| `STRIPE_KEY`   | Stripe secret key (`sk_test_...`) — payments service only |

For example on Windows:
```
set JWT_KEY=anysecretyouwant
set MONGO_URI=mongodb://localhost:27017/auth
```

> **Note:** Auth cookies use `secure: 'auto'`, so they work over plain HTTP locally without any extra configuration.

### Manual Docker images

All images are built from the repo root using `-f` to point at the service Dockerfile:

```bash
docker build -t richdgo4/auth -f auth/Dockerfile .
```

Run with required env vars (see above), for example:
```bash
docker run -e JWT_KEY=anysecretyouwant richdgo4/auth
```

### Kubernetes (w. Skaffold)

Install Skaffold by following the instructions at https://skaffold.dev/docs/install/

You can run the apps on a local cluster or deploy them to GCP — pick one of the options below.

#### Option 1: Local cluster

**Prerequisites:**
1. Docker Desktop with Kubernetes enabled (or your favourite tooling)
2. Install Ingress NGINX to your k8s cluster:
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/cloud/deploy.yaml
   ```
3. Create the JWT signing key 
   ```bash
   kubectl create secret generic jwt-secret --from-literal=JWT_KEY=mysupersecretthingy
   ```
4. Create the Stripe secret (payments service)
   ```bash
   kubectl create secret generic stripe-secret --from-literal=STRIPE_KEY=sk_test_blah
   ```
> **Note:** MongoDB deployments in the local cluster have no PersistentVolumeClaims — data is stored in the container's ephemeral layer and lost when a pod restarts. This is intentional for local dev; the GCP manifests include PVCs.

**Run:**
```bash
skaffold dev
```

This builds all service images, deploys them to your local cluster, and watches for file changes — syncing `.ts` files directly into running containers without a full rebuild. The app will be available at `http://localhost`, e.g. `http://localhost/api/users/signup`.

The RabbitMQ management UI is available at `http://localhost:15672` (default credentials: `guest` / `guest`). The AMQP port (5672) is also forwarded, so you can publish messages directly to `amqp://localhost:5672` without going through a service — useful for testing consumers in isolation. Postman supports AMQP if you want a GUI for this.

#### Option 2: GCP cluster

> **Note:** The cluster and project details below are from a free GCP trial and may no longer be active.

**One-time machine setup:**
1. Initialise gcloud and set your default project, region, and zone:
   ```
   gcloud init
   ```
2. Install the GKE authentication plugin for kubectl:
   ```
   gcloud components install gke-gcloud-auth-plugin
   ```
3. Authenticate Docker with Artifact Registry:
   ```
   gcloud auth configure-docker europe-north1-docker.pkg.dev
   ```
4. Create the Artifact Registry repository (one per GCP project, shared across clusters):
   ```
   gcloud artifacts repositories create ticketing --repository-format=docker --location=europe-north1 --project=project-809e066d-e5ea-4d42-aa1
   ```
5. Create secrets with Secret Manager called `JWT_KEY` and `STRIPE_KEY`
6. Pull the values from Secret Manager
   ```
   for /f "delims=" %i in ('gcloud secrets versions access latest --secret=JWT_KEY') do set JWT_VAL=%i
   kubectl create secret generic jwt-secret --from-literal=JWT_KEY=%JWT_VAL%
   for /f "delims=" %i in ('gcloud secrets versions access latest --secret=STRIPE_KEY') do set STRIPE_VAL=%i
   kubectl create secret generic stripe-secret --from-literal=STRIPE_KEY=%STRIPE_VAL%
   ```

**Cluster setup:**
1. Ensure your Google Cloud project has a Kubernetes cluster
2. Fetch the Kubernetes context for your GCP cluster:
   ```
   gcloud container clusters get-credentials <cluster-name> --region <region> --project <project-id>
   ```
   For this project: cluster `cluster-feck`, region `europe-north1`, project `project-809e066d-e5ea-4d42-aa1`.
3. Install Ingress NGINX to your GKE cluster:
   ```
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.15.1/deploy/static/provider/cloud/deploy.yaml
   ```
4. Grant the cluster's node service account pull access to Artifact Registry (repeat for each new cluster, replace `<PROJECT_NUMBER>`):
   - Get your project number:
     ```
     gcloud projects describe project-809e066d-e5ea-4d42-aa1 --format="value(projectNumber)"
     ```
   - Grant access:
     ```
     gcloud projects add-iam-policy-binding project-809e066d-e5ea-4d42-aa1 --member="serviceAccount:<PROJECT_NUMBER>-compute@developer.gserviceaccount.com" --role="roles/artifactregistry.reader"
     ```
5. Run `kubectl get ingress` to see the external IP of the cluster.

**Resuming dev:**
1. Authenticate gcloud with your Google credentials:
   ```
   gcloud auth login
   ```
2. Verify kubectl is pointing at the GKE cluster:
   ```
   kubectl config current-context
   ```   

**Run:**
```bash
skaffold run -p gcp
```

This builds service images locally, pushes them to Artifact Registry, and deploys them to your GKE cluster. Unlike `skaffold dev`, it is a one-shot deploy with no file watching. Run `kubectl get ingress` to get the IP address for the app in GCP.

The app will be available at your ingress IP, e.g. `http://35.228.198.217/api/hedgehog/consult`
```
                                     \ / \/ \/ / ,
                                   \ /  \/ \/  \/  / ,
                                 \ \ \/ \/ \/ \ \/ \/ /
                               .\  \/  \/ \/ \/  \/ / / /
                              '  / / \/  \/ \/ \/  \/ \ \/ \
                           .'     ) \/ \/ \/ \/  \/  \/ \ / \
                          /   o    ) \/ \/ \/ \/ \/ \/ \// /
                        o'_ ',__ .'   ,.,.,.,.,.,.,.,'- '/
                                 // \\          // \\ 
                                ''  ''         ''  ''
```