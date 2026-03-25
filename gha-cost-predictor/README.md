# GHA Cost Predictor

**ML-powered pre-run cost estimation for GitHub Actions workflows.**

Predict the duration and financial cost of GitHub Actions workflow runs *before* they execute, using trained machine learning models (XGBoost / RandomForest). The system parses workflow YAML, extracts structural features, predicts execution duration, and calculates cost using live GitHub pricing data.

---

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   React UI  │────▶│            FastAPI Backend                │
│  (Frontend) │◀────│                                          │
└─────────────┘     │  ┌──────────┐  ┌────────────────────┐   │
                    │  │ Routers  │  │  ML Prediction      │   │
                    │  │          │  │  Engine              │   │
                    │  │ /predict │  │  ┌────────────────┐ │   │
                    │  │ /webhook │──│  │Feature Extractor│ │   │
                    │  │ /pricing │  │  │XGBoost / RF     │ │   │
                    │  └──────────┘  │  └────────────────┘ │   │
                    │                └────────────────────┘   │
                    │  ┌──────────────┐  ┌──────────────────┐  │
                    │  │Pricing Svc   │  │ GitHub Service   │  │
                    │  │(live fetch)  │  │ (PR comments)    │  │
                    │  └──────────────┘  └──────────────────┘  │
                    │  ┌──────────────────────────────────────┐│
                    │  │        SQLite Database               ││
                    │  └──────────────────────────────────────┘│
                    └──────────────────────────────────────────┘
                                      │
                                      ▼
                            GitHub Actions API
```

## Components

| Component | Path | Tech |
|-----------|------|------|
| **Frontend** | `frontend/` | React 18, Tailwind CSS, Recharts, Lucide |
| **Backend** | `backend/` | FastAPI, SQLAlchemy, httpx |
| **ML Engine** | `backend/app/ml/` | XGBoost, scikit-learn, joblib |
| **Database** | SQLite | Via SQLAlchemy async |

## Features

- **Instant YAML Prediction** — Paste workflow YAML or upload `.yml` files for instant cost estimates
- **Repository Scanning** — Fetch and analyze all workflows from a GitHub repo
- **Live Pricing** — Fetches runner pricing from GitHub docs; auto-caches with configurable TTL
- **PR Comments** — Posts beautifully formatted cost predictions as PR comments via webhooks
- **Prediction History** — Full history with filtering, pagination, and search
- **Model Hot-reload** — Swap ML models at runtime without restart
- **Webhook Automation** — Auto-predict on push (workflow file changes), PR open/sync, and workflow_run events

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Generate sample ML model (if you don't have your own)
python ml_models/generate_sample_model.py

# Configure environment
# Edit .env with your GitHub token (optional, needed for PR comments)

# Run the server
python main.py
```

The API will be available at `http://localhost:8000`. Docs at `http://localhost:8000/docs`.

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm start
```

The frontend will be available at `http://localhost:3000`.

### 3. Using Your Own Trained Model

Place your trained model file at `backend/ml_models/model.joblib`. The model must:
- Accept a feature vector of **20 features** (see feature list below)
- Have a `.predict()` method (scikit-learn compatible)
- Be saved via `joblib.dump()`

The system will auto-detect the model type (XGBoost, RandomForest, etc.).

## Feature Vector (20 features)

| # | Feature | Description |
|---|---------|-------------|
| 1 | `num_jobs` | Number of jobs in the workflow |
| 2 | `total_steps` | Total steps across all jobs |
| 3 | `runner_os_encoded` | 0=Linux, 1=Windows, 2=macOS |
| 4 | `has_matrix` | Whether matrix strategy is used |
| 5 | `matrix_combinations` | Number of matrix combinations |
| 6 | `has_cache` | Whether caching is used |
| 7 | `has_artifacts` | Whether artifacts are used |
| 8 | `num_env_vars` | Number of environment variables |
| 9 | `has_services` | Whether service containers are used |
| 10 | `has_timeout` | Whether timeout-minutes is set |
| 11 | `num_uses_actions` | Number of `uses:` actions |
| 12 | `num_run_commands` | Number of `run:` commands |
| 13 | `has_conditional` | Whether `if:` conditions are used |
| 14 | `trigger_count` | Number of trigger events |
| 15 | `has_checkout` | Whether actions/checkout is used |
| 16 | `has_setup_action` | Whether setup-* actions are used |
| 17 | `has_docker` | Whether Docker is used |
| 18 | `estimated_complexity` | Derived complexity score |
| 19 | `max_parallel_jobs` | Max parallel job count |
| 20 | `has_needs_dependency` | Whether job dependencies exist |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/predictions/predict` | Predict from raw YAML |
| `POST` | `/api/predictions/predict-repo` | Predict all workflows in a repo |
| `GET` | `/api/predictions/history` | Paginated prediction history |
| `GET` | `/api/predictions/{id}` | Get single prediction |
| `GET` | `/api/predictions/model/info` | ML model information |
| `POST` | `/api/predictions/model/reload` | Hot-reload model |
| `GET` | `/api/pricing/` | Current runner pricing |
| `POST` | `/api/pricing/refresh` | Force-refresh pricing |
| `POST` | `/api/webhooks/github` | GitHub webhook handler |

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
