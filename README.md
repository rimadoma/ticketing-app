# Ticketing App

## Running Locally

### Directly

Each service lives in its own directory. To run a service, e.g. auth:

```bash
cd auth
npm install
npm run dev
```

Check the service's index.ts for its port, e.g. http://localhost:3000

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

**Run:**
```bash
skaffold dev
```

This builds all service images, deploys them to your local cluster, and watches for file changes — syncing `.ts` files directly into running containers without a full rebuild. The app will be available at `http://localhost`.

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

**Cluster setup:**
1. Ensure your Google Cloud project has a Kubernetes cluster and Cloud Build enabled
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

This builds service images on GCP via Cloud Build, pushes them to Artifact Registry, and deploys them to your GKE cluster. Unlike `skaffold dev`, it is a one-shot deploy with no file watching. Run `kubectl get ingress` to get the IP addres for the app in GCP.
