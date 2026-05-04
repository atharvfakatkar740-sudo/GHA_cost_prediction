# GHA Cost Predictor

**ML-powered pre-run cost estimation for GitHub Actions workflows.**

Predict the duration and financial cost of GitHub Actions workflow runs *before* they execute, using trained machine learning models (XGBoost / RandomForest). The system parses workflow YAML, extracts 21 structural features, predicts execution duration, and calculates cost using live GitHub pricing data.

---

## Features

- **Instant YAML Prediction** — Paste workflow YAML or upload `.yml` files for instant cost estimates
- **Repository Scanning** — Fetch and analyze all workflows from a GitHub repo
- **Live Pricing** — Fetches runner pricing from GitHub docs; auto-caches with configurable TTL
- **PR & Commit Comments** — Posts beautifully formatted cost predictions via webhooks
- **User Accounts** — Register, login, and password reset via Google SMTP
- **Per-user History** — All predictions stored in the user's account
- **Light / Dark Mode** — Switchable theme with solid pastel palette
- **Webhook Automation** — Auto-predict on push, pull_request, and workflow_run events
- **Model Hot-reload** — Swap ML models at runtime without restart

## Tech Stack

| Component | Path | Tech |
|-----------|------|------|
| **Frontend** | `frontend/` | React 18, Tailwind CSS, Lucide, react-hot-toast |
| **Backend** | `backend/` | FastAPI, SQLAlchemy 2.0, httpx, python-jose |
| **ML Engine** | `backend/app/ml/` | XGBoost, scikit-learn Pipeline, joblib |
| **Database** | PostgreSQL | Via SQLAlchemy async + asyncpg |
| **Auth** | JWT + bcrypt | Password reset via Google SMTP (aiosmtplib) |

---

## Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **PostgreSQL 14+** (running locally or via Docker)

### 1. PostgreSQL Setup

```bash
# Option A: If you have PostgreSQL installed locally
psql -U postgres -c "CREATE DATABASE gha_cost_predictor;"

# Option B: Docker (one-liner)
docker run -d --name gha-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=gha_cost_predictor -p 5432:5432 postgres:16
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL, JWT_SECRET_KEY
# For password reset: set SMTP_USER, SMTP_PASSWORD (see SMTP section below)

# Generate sample ML model (if you don't have your own)
python ml_models/generate_sample_model.py

# Run the server (auto-creates tables on startup)
python main.py
```

The API will be at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend will be at `http://localhost:3000`.

### 4. Using Your Own Trained Model

Place your trained model at `backend/ml_models/model.joblib`. The model must:
- Accept a DataFrame with **21 feature columns** (see below)
- Have a `.predict()` method (scikit-learn Pipeline or raw estimator)
- Be saved via `joblib.dump()`

The engine auto-detects Pipeline vs raw model and extracts the inner estimator name.

### 5. Google SMTP Setup (Password Reset)

1. **Enable 2-Step Verification** on your Google Account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate a password for "Mail" → "Other (Custom name)" → "GHA Cost Predictor"
4. Copy the 16-character app password
5. Set in `.env`:
   ```env
   SMTP_USER=your_email@gmail.com
   SMTP_PASSWORD=abcd efgh ijkl mnop    # the 16-char app password
   SMTP_FROM_EMAIL=your_email@gmail.com
   ```

---

## Docker Deployment (recommended)

### Prerequisites
- Docker + Docker Compose

### 1. Configure environment

```bash
# Copy and fill in secrets (at minimum GITHUB_TOKEN and JWT_SECRET_KEY)
cp backend/.env.example .env
```

Only these variables need to be set in a root-level `.env` file — everything else has safe defaults:

```env
GITHUB_TOKEN=ghp_...
GITHUB_WEBHOOK_SECRET=your-secret
JWT_SECRET_KEY=a-long-random-string
POSTGRES_PASSWORD=postgres          # optional override
SMTP_USER=your@gmail.com            # optional, for password-reset emails
SMTP_PASSWORD=app-password
SMTP_FROM_EMAIL=your@gmail.com
REACT_APP_API_URL=http://localhost:8000   # URL the browser uses to call the API
```

### 2. (Optional) Generate a sample ML model

```bash
docker compose run --rm backend python ml_models/generate_sample_model.py
```

Or place your own trained `model.joblib` in `backend/ml_models/`.

### 3. Start everything

```bash
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

Stop with `Ctrl+C` then `docker compose down`. Add `-v` to also delete the database volume.

---

## Kubernetes Deployment

### Prerequisites
- `docker` — to build images
- `kubectl` — configured to point at your cluster
- An **Ingress controller** in the cluster (e.g. ingress-nginx)

For local development with **minikube**:
```bash
minikube start
minikube addons enable ingress
```

### 1. Edit secrets

Open `k8s/02-secrets.yaml` and replace the `base64` placeholders with real values:
```bash
echo -n 'your-value' | base64
```

> **Never** commit real secrets. Use [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets) or an external secret manager in production.

### 2. Deploy with one command

```bash
chmod +x k8s/deploy.sh
./k8s/deploy.sh
```

Options:
```bash
./k8s/deploy.sh --tag v1.2.3      # tag images with a specific version
./k8s/deploy.sh --skip-build      # skip docker build (use existing images)
```

The script:
1. Detects minikube and uses its Docker daemon automatically
2. Builds `gha-cost-predictor/backend:latest` and `gha-cost-predictor/frontend:latest`
3. Applies all manifests in `k8s/` in dependency order
4. Waits for all rollouts to complete

### 3. Access the application

**Via Ingress** — add `127.0.0.1  gha.local` to your `/etc/hosts`, then open `http://gha.local`.

**Via port-forward** (no DNS change needed):
```bash
kubectl port-forward svc/frontend-svc 3000:80  -n gha-cost-predictor
kubectl port-forward svc/backend-svc  8000:8000 -n gha-cost-predictor
```

### Kubernetes manifest overview

| File | Resource(s) |
|------|-------------|
| `k8s/00-namespace.yaml` | `Namespace: gha-cost-predictor` |
| `k8s/01-configmap.yaml` | Non-secret environment variables |
| `k8s/02-secrets.yaml` | Passwords, tokens, JWT key |
| `k8s/03-postgres.yaml` | Postgres PVC + Deployment + headless Service |
| `k8s/04-backend.yaml` | Backend PVC + Deployment (2 replicas) + ClusterIP Service |
| `k8s/05-frontend.yaml` | Frontend Deployment (2 replicas) + ClusterIP Service |
| `k8s/06-ingress.yaml` | nginx Ingress routing `/api` → backend, `/` → frontend |

---

## Feature Vector (21 features)

| # | Feature | Type | Description |
|---|---------|------|-------------|
| 1 | `yaml_line_count` | int | Total lines in the workflow YAML |
| 2 | `yaml_depth` | int | Max nesting depth of the YAML |
| 3 | `job_count` | int | Number of jobs |
| 4 | `total_steps` | int | Total steps across all jobs |
| 5 | `avg_steps_per_job` | float | Average steps per job |
| 6 | `uses_matrix_strategy` | int | 0/1 — matrix strategy used |
| 7 | `matrix_dimensions` | int | Number of matrix dimensions |
| 8 | `matrix_permutations` | int | Total matrix combinations |
| 9 | `fail_fast` | int | 0/1 — fail-fast enabled |
| 10 | `os_label` | str | Runner label (e.g. `ubuntu-latest`) |
| 11 | `timeout_minutes` | int | Max timeout-minutes across jobs |
| 12 | `unique_actions_used` | int | Count of distinct actions used |
| 13 | `is_using_setup_actions` | int | 0/1 — setup-* actions present |
| 14 | `is_using_docker_actions` | int | 0/1 — Docker used |
| 15 | `is_using_cache` | int | 0/1 — caching actions present |
| 16 | `env_var_count` | int | Total environment variables |
| 17 | `if_condition_count` | int | Total `if:` conditions |
| 18 | `needs_dependencies_count` | int | Total `needs:` dependencies |
| 19 | `code_complexity` | float | Weighted complexity score |
| 20 | `primary_language` | str | Primary repo language |
| 21 | `has_container` | int | 0/1 — job uses a container |

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | — | Create a new account |
| `POST` | `/api/auth/login` | — | Get JWT access token |
| `POST` | `/api/auth/forgot-password` | — | Send reset email |
| `POST` | `/api/auth/reset-password` | — | Reset with token |
| `POST` | `/api/predictions/predict` | Optional | Predict from raw YAML |
| `POST` | `/api/predictions/predict-repo` | Optional | Predict all repo workflows |
| `GET` | `/api/predictions/me` | Required | User's own predictions |
| `GET` | `/api/predictions/history` | — | All predictions (paginated) |
| `GET` | `/api/predictions/{id}` | — | Single prediction |
| `GET` | `/api/predictions/model/info` | — | ML model info |
| `POST` | `/api/predictions/model/reload` | — | Hot-reload model |
| `GET` | `/api/pricing/` | — | Current runner pricing |
| `POST` | `/api/pricing/refresh` | — | Force-refresh pricing |
| `POST` | `/api/webhooks/github` | — | GitHub webhook handler |

## Cost Calculation

```
Cost ($) = ceil(predicted_duration_minutes) × per_minute_rate
```

Per-minute rates are fetched from [GitHub Actions Runner Pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing):

| Runner | Per Minute |
|--------|-----------|
| Linux (standard) | $0.008 |
| Windows (standard) | $0.016 |
| macOS (standard) | $0.080 |
| Linux ARM | $0.005 |

## GitHub Webhook Setup

The webhook automates predictions whenever workflow files are added or modified in your repository. Once configured, the system runs entirely hands-free.

### Supported Events

| Event | When It Fires | What Happens |
|-------|---------------|--------------|
| **`push`** | Any commit that adds/modifies a `.github/workflows/*.yml` file | Fetches the updated workflow, runs prediction, posts a **commit comment**, and also comments on any **open PRs** for that branch |
| **`pull_request`** | PR opened, new commits pushed, or PR reopened | Predicts cost of changed (or all) workflow files and posts a **PR comment** |
| **`workflow_run`** | A workflow run is *requested* (before execution) | Predicts cost for that specific workflow and posts to the associated PR or commit |

### Step-by-Step Setup

#### 1. Expose Your Backend

Your FastAPI server must be reachable from the internet so GitHub can deliver webhooks. Options:

- **Production** — Deploy behind a reverse proxy (nginx, Caddy) with HTTPS
- **Development** — Use a tunnel like [ngrok](https://ngrok.com), [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/), or [smee.io](https://smee.io)

```bash
# Example with ngrok (dev only)
ngrok http 8000
# Note the https://xxxx.ngrok-free.app URL
```

#### 2. Configure `.env`

```env
# Personal access token with repo scope (needed to read workflow files + post comments)
GITHUB_TOKEN=ghp_your_token_here

# A random string you choose — must match what you enter in GitHub
GITHUB_WEBHOOK_SECRET=my-super-secret-string
```

> **Token permissions required:** `repo` scope (for private repos) or `public_repo` (for public repos only). The token needs read access to repository contents and write access to pull request / commit comments.

#### 3. Create the Webhook in GitHub

1. Navigate to your repository on GitHub
2. Go to **Settings → Webhooks → Add webhook**
3. Fill in:

| Field | Value |
|-------|-------|
| **Payload URL** | `https://your-domain.com/api/webhooks/github` |
| **Content type** | `application/json` |
| **Secret** | Same value as `GITHUB_WEBHOOK_SECRET` in your `.env` |

4. Under **"Which events would you like to trigger this webhook?"**, select **"Let me select individual events"** and check:
   - **Pushes** — triggers on every push to any branch
   - **Pull requests** — triggers on PR open / sync / reopen
   - **Workflow runs** *(optional)* — triggers when a workflow execution is requested

5. Ensure **Active** is checked, then click **Add webhook**

#### 4. Verify the Connection

GitHub sends a `ping` event immediately after creation. Check your backend logs for:

```
INFO | Received ping event — webhook is active
```

You can also check the webhook delivery history at **Settings → Webhooks → (your webhook) → Recent Deliveries**.

### Automation Flow

```
Developer pushes a commit that modifies .github/workflows/ci.yml
  │
  ▼
GitHub fires a `push` webhook to your server
  │
  ▼
Backend detects ci.yml was modified in the commit
  │
  ├─▶ Fetches ci.yml content at the head commit SHA
  ├─▶ Extracts 20 features from the YAML structure
  ├─▶ ML model predicts duration → pricing formula calculates cost
  ├─▶ Saves prediction to SQLite database
  ├─▶ Posts a formatted commit comment on the push commit
  │
  └─▶ Finds any open PRs for the branch
      └─▶ Posts the same prediction as a PR comment
```

### Troubleshooting

- **401 Invalid signature** — The `GITHUB_WEBHOOK_SECRET` in `.env` doesn't match the secret entered in GitHub
- **No comment posted** — Check that `GITHUB_TOKEN` is set and has the correct scopes
- **"skipped: no_workflow_files_changed"** — The push didn't modify any files under `.github/workflows/`; this is expected and means no prediction was needed
- **Timeout / no delivery** — Ensure your server is reachable from the internet and the Payload URL is correct

## License

MIT
