# Ticketing App

## How to build, deploy & dev

### Standalone locally

Testing frontend (client/) standalone will be a major pain in the bum. I don't recommend it. Also, there are no config files, so you may need to change many hard-coded consts, e.g. cluster URL to localhost That being said, each service lives in its own directory. The shared library (`common/`) is published to npm as [`@mahonen_consulting_zlc/common`](https://www.npmjs.com/package/@mahonen_consulting_zlc/common) and installed as a regular dependency. To run a service, e.g. auth:

```bash
cd auth
npm install
npm run dev
```

The service will be available at `http://localhost:<port>/<route>`, e.g. auth at `http://localhost:3000/api/users/signup`

#### Environment variables

Some services require environment variables that are normally injected by Kubernetes. Set these in your shell before running:

| Variable    | Description                                              |
|-------------|----------------------------------------------------------|
| `JWT_KEY`   | Secret used to sign/verify JWTs — any string works locally |
| `MONGO_URI` | MongoDB connection string, e.g. `mongodb://localhost:27017/<service>` |

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
> **Note:** MongoDB deployments in the local cluster have no PersistentVolumeClaims — data is stored in the container's ephemeral layer and lost when a pod restarts. This is intentional for local dev; the GCP manifests include PVCs.

**Run:**
```bash
skaffold dev
```

This builds all service images, deploys them to your local cluster, and watches for file changes — syncing `.ts` files directly into running containers without a full rebuild. The app will be available at `http://localhost`, e.g. `http://localhost/api/users/signup`.

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
5. Create a secret with Secret Manager called `JWT_KEY`
6. Pull the value from Secret Manager
   ```
   for /f "delims=" %i in ('gcloud secrets versions access latest --secret=JWT_KEY') do set JWT_VAL=%i
   kubectl create secret generic jwt-secret --from-literal=JWT_KEY=%JWT_VAL%
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