# Repository Webhook Tracking Feature

## Overview

Added comprehensive repository-wise cost tracking with webhook integration. Users can now:
- Track specific repositories and set up webhooks
- View repository-specific cost analytics and charts
- Automatically associate webhook events with their account
- Monitor per-repository spending trends over time

---

## Backend Changes

### 1. Database Model (`app/models/database.py`)

**Added `TrackedRepository` model:**
- Links repositories to users with unique webhook secrets
- Tracks last event timestamp and active status
- Cascade deletes when user is removed

**Updated `User` model:**
- Added `tracked_repositories` relationship

### 2. Schemas (`app/models/schemas.py`)

**New schemas:**
- `TrackRepoRequest` - Register a repository
- `TrackedRepoItem` - Repository with aggregated stats
- `WebhookSetupInfo` - Webhook configuration details
- `TrackedRepoResponse` - Combined repo + webhook info
- `WorkflowCostItem` - Per-workflow cost breakdown
- `RepoStatsResponse` - Detailed repository analytics

### 3. Repositories Router (`app/routers/repositories.py`)

**Endpoints:**
- `POST /api/repositories` - Track a new repository
- `GET /api/repositories` - List tracked repos with stats
- `GET /api/repositories/{id}/webhook` - Get webhook setup info
- `POST /api/repositories/{id}/rotate-secret` - Rotate webhook secret
- `DELETE /api/repositories/{id}` - Untrack repository
- `GET /api/repositories/{id}/stats` - Detailed repo analytics

**Features:**
- Per-repository webhook secrets (40-char hex tokens)
- Aggregated cost/duration/prediction count per repo
- Daily cost trends and workflow-level breakdowns
- Recent predictions list

### 4. Webhook Handler Updates (`app/routers/webhooks.py`)

**Enhanced webhook processing:**
- Resolves tracked repository from payload
- Uses per-repo secret for signature verification (falls back to global)
- Associates predictions with repository owner's user_id
- Updates `last_event_at` timestamp on each event

**Modified handlers:**
- `_handle_push()` - Now accepts `user_id`
- `_handle_pull_request()` - Now accepts `user_id`
- `_handle_workflow_run()` - Now accepts `user_id`

### 5. Prediction Service (`app/services/prediction_service.py`)

**Updated:**
- `predict_repo_workflows()` - Now accepts optional `user_id` parameter
- Threads `user_id` through to `predict_from_yaml()`

### 6. Configuration (`config.py`)

**Added:**
- `PUBLIC_BASE_URL` - Base URL for webhook payload endpoint (defaults to `http://localhost:8000`)

### 7. Main App (`main.py`)

**Registered:**
- `repositories` router

---

## Frontend Changes

### 1. API Service (`services/api.js`)

**New functions:**
- `trackRepository(repoOwner, repoName)` - Register repository
- `listTrackedRepositories()` - Get user's tracked repos
- `getWebhookInfo(repoId)` - Fetch webhook setup details
- `rotateWebhookSecret(repoId)` - Generate new secret
- `untrackRepository(repoId)` - Remove tracking
- `getRepoStats(repoId, days)` - Get detailed analytics

### 2. Repositories Page (`pages/RepositoriesPage.jsx`)

**Features:**
- **Add Repository Form** - Track new repos by owner/name
- **Repository Cards** - Grid view with key metrics
- **Webhook Setup Modal** - Copy-paste instructions with:
  - Payload URL
  - Content type
  - Secret (show/hide toggle)
  - Events list
  - Secret rotation
  - Direct link to GitHub webhook settings
- **Repository Stats Modal** - Detailed analytics with:
  - KPI cards (predictions, total cost, avg duration, avg cost)
  - Daily cost line chart
  - Cost by workflow bar chart
  - Recent predictions list
  - Date range selector (7/30/90 days)

**UI/UX:**
- GitHub dark theme styling
- Responsive grid layout
- Icon-based actions (webhook, stats, delete)
- Toast notifications for all actions
- Loading states and empty states

### 3. Layout & Navigation (`components/Layout.jsx`, `App.jsx`)

**Added:**
- "Repositories" nav item (auth-only)
- Route: `/repositories` → `RepositoriesPage`
- User dropdown menu link
- Sidebar navigation link

---

## How It Works

### Setup Flow

1. **User tracks a repository:**
   - Enters `owner/repo` in the form
   - Backend creates `TrackedRepository` record with unique secret
   - Returns webhook setup instructions

2. **User configures GitHub webhook:**
   - Opens webhook setup modal
   - Copies payload URL, secret, and events
   - Navigates to GitHub repo settings
   - Creates webhook with copied values

3. **GitHub sends events:**
   - Webhook handler resolves tracked repo
   - Verifies signature using repo-specific secret
   - Associates prediction with repo owner's `user_id`
   - Updates `last_event_at` timestamp

4. **User views analytics:**
   - Opens repo stats modal
   - Sees cost trends, workflow breakdowns, recent predictions
   - Filters by date range (7/30/90 days)

### Security

- **Per-repository secrets:** Each tracked repo has a unique 40-character hex token
- **Signature verification:** HMAC SHA-256 validation on all webhook events
- **User isolation:** Predictions only visible to repository owner
- **Secret rotation:** Users can regenerate secrets without re-tracking

### Data Flow

```
GitHub Event → Webhook Handler
  ↓
Resolve TrackedRepository (owner, name)
  ↓
Verify signature (repo.webhook_secret)
  ↓
Extract user_id from tracked repo
  ↓
Run prediction with user_id
  ↓
Store prediction linked to user
  ↓
Update last_event_at
```

---

## Database Migration

**Required:** Add `tracked_repositories` table

```sql
CREATE TABLE tracked_repositories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    repo_owner VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_event_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tracked_repos_user ON tracked_repositories(user_id);
CREATE INDEX idx_tracked_repos_owner_name ON tracked_repositories(repo_owner, repo_name);
```

---

## Environment Variables

**New (optional):**
- `PUBLIC_BASE_URL` - Public URL where GitHub can reach the webhook endpoint
  - Default: `http://localhost:8000`
  - Production: Set to your public domain or ngrok URL (e.g., `https://abc.ngrok.io`)

---

## Testing

### Manual Testing Steps

1. **Track a repository:**
   ```bash
   # Login, navigate to /repositories
   # Add owner/repo (e.g., "octocat/Hello-World")
   # Verify webhook modal appears with setup instructions
   ```

2. **Configure webhook on GitHub:**
   ```bash
   # Copy payload URL and secret
   # Go to https://github.com/{owner}/{repo}/settings/hooks/new
   # Paste values, select events: push, pull_request, workflow_run
   # Save webhook
   ```

3. **Trigger webhook:**
   ```bash
   # Push to repo or open a PR
   # Check backend logs for webhook event
   # Verify prediction appears in repo stats
   ```

4. **View analytics:**
   ```bash
   # Click stats icon on repo card
   # Verify charts render with data
   # Change date range, verify data updates
   ```

5. **Rotate secret:**
   ```bash
   # Open webhook modal
   # Click "Rotate Secret"
   # Update secret on GitHub
   # Trigger event, verify still works
   ```

6. **Untrack repository:**
   ```bash
   # Click delete icon
   # Confirm deletion
   # Verify repo removed from list
   ```

---

## Files Modified

### Backend
- `app/models/database.py` - Added `TrackedRepository` model
- `app/models/schemas.py` - Added 7 new schemas
- `app/routers/repositories.py` - **NEW** - Full CRUD + stats
- `app/routers/webhooks.py` - Enhanced with repo resolution
- `app/services/prediction_service.py` - Added `user_id` parameter
- `config.py` - Added `PUBLIC_BASE_URL`
- `main.py` - Registered repositories router

### Frontend
- `services/api.js` - Added 6 repository functions
- `pages/RepositoriesPage.jsx` - **NEW** - Full UI with modals
- `components/Layout.jsx` - Added nav link + icon
- `App.jsx` - Added route + import

---

## Future Enhancements

- **Bulk tracking:** Import multiple repos from GitHub org
- **Webhook health:** Monitor webhook delivery success/failure
- **Cost alerts:** Email notifications when repo exceeds budget
- **Team sharing:** Share tracked repos with team members
- **GitHub App:** OAuth-based repo discovery and auto-setup
- **Workflow recommendations:** AI-powered cost optimization tips per repo

---

## Summary

This feature transforms the GHA Cost Predictor from a manual prediction tool into a **continuous monitoring platform**. Users can now:

✅ Set up webhooks in minutes  
✅ Track costs automatically per repository  
✅ View detailed analytics with beautiful charts  
✅ Manage multiple repositories from one dashboard  
✅ Secure webhooks with per-repo secrets  

The implementation is production-ready with proper error handling, loading states, and user feedback throughout.
