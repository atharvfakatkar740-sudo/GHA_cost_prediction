# GHA Cost Predictor — Full Upgrade Plan

A meticulous end-to-end upgrade covering ML model accuracy, backend auth/API fixes, and a GitHub-inspired dark dashboard UI redesign.

---

## Overview of Changes

| Area | Scope | Files Touched |
|---|---|---|
| **ML — Notebook fixes** | Fix log-transform, encoding, code_complexity in RF + XGB notebooks | `03_random_forest_regression.ipynb`, `04_xgboost_regression.ipynb` |
| **ML — New LightGBM notebook** | Full LightGBM training pipeline | `05_lightgbm_regression.ipynb` (new) |
| **Backend — Feature extractor** | Real `code_complexity` via GitHub API, new features | `feature_extractor.py`, `workflow_parser.py`, `engine.py` |
| **Backend — Auth fix** | User-scoped history, `/me` endpoint wired to frontend | `predictions.py`, `PredictionHistory.jsx`, `Dashboard.jsx`, `api.js` |
| **Backend — Analytics endpoint** | New `/api/predictions/stats` for dashboard charts | `predictions.py` (new route) |
| **Frontend — Theme** | GitHub dark + teal glow aesthetic | `tailwind.config.js`, `index.css` |
| **Frontend — Dashboard** | Full personal analytics dashboard with charts | `Dashboard.jsx` (full rewrite) |
| **Frontend — Layout** | Sidebar navigation (like reference image), user avatar menu | `Layout.jsx` |
| **Frontend — New pages** | `ProfilePage.jsx`, `AnalyticsPage.jsx` | New files |

---

## Part A — ML Model Improvements

### A1 — Fix Existing Notebooks (`03_` and `04_`)

Both notebooks already use `log1p` transform (confirmed from cell outputs) — **the target transform is already correct**. The reported MAPE in your summary (179%) must be from a prior run. The actual bottleneck is:

**Fixes to apply to both notebooks:**

1. **`os_label` encoding**: Replace `LabelEncoder` (assigns `macos=0, ubuntu=2, windows=3` arbitrarily) with **median-target encoding** on training data only:
   ```python
   os_median = X_train.join(y_train_log.rename('y')).groupby('os_label')['y'].median()
   df['os_label'] = df['os_label'].map(os_median)
   ```
   This correctly captures `macos > windows > ubuntu` signal.

2. **`primary_language` encoding**: Same issue — 36 categories label-encoded as integers. Switch to **mean-target encoding** (fit on train fold only).

3. **`code_complexity` enrichment** (see A3 — apply after feature pipeline update):
   Replace the current formula-based `code_complexity` float with the real GitHub API metrics (see A3 below).

4. **Drop Tier-3 noise features** from both notebooks:
   Remove from `X`: `matrix_dimensions`, `is_using_docker_actions`, `fail_fast`, `if_condition_count`, `has_container`
   New feature count: **16 features**

5. **Add new engineered features** (after A3 is done):
   - `run_command_line_count` — total lines in all `run:` blocks
   - `workflow_trigger_is_pr` — binary, from `on:` block
   - `repo_size_kb` — from GitHub API (cold-start safe)

6. **Residual fix in XGB notebook**: The XGB notebook was run on only 9,011 rows (subset), while RF used 196K. Ensure both notebooks use the full `comprehensive_features.csv` (196K rows).

---

### A2 — New Notebook: `05_lightgbm_regression.ipynb`

Full pipeline notebook. Sections:

| Cell | Content |
|---|---|
| 0 | Title + step table |
| 1 | Imports (`lightgbm`, `sklearn`, `shap`, `optuna` optional) |
| 2 | Load full 196K dataset |
| 3 | Type casting + IQR outlier removal |
| 4 | **Median/mean target encoding** for `os_label` + `primary_language` |
| 5 | Drop Tier-3 features, add new engineered features |
| 6 | `log1p` target, train/val/test split (60/20/20) |
| 7 | **Baseline LightGBM** with early stopping |
| 8 | **Optuna hyperparameter search** (50 trials, `n_estimators` via early stopping) |
| 9 | SHAP feature importance (beeswarm + bar) |
| 10 | Residual diagnostics (4-panel) |
| 11 | Model comparison table (RF vs XGB vs LightGBM) |
| 12 | Export: `joblib.dump(lgb_tuned, 'lgb_model.joblib')` |

Key LightGBM config:
```python
lgb.LGBMRegressor(
    boosting_type='gbdt',
    num_leaves=63,
    learning_rate=0.05,
    n_estimators=2000,          # pruned by early stopping
    min_child_samples=20,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=0.1,
    random_state=42,
)
```

---

### A3 — Better `code_complexity` Feature (Backend)

**File: `workflow_parser.py` + `feature_extractor.py`**

Replace the current formula `num_jobs*1.0 + total_steps*0.5 + ...` with a multi-signal composite:

#### Sub-features to extract:

1. **`run_command_line_count`** — count total `\n` in all `run:` step blocks (already in YAML, zero API calls)
2. **`workflow_trigger_is_pr`** — `1` if `on: pull_request` exists in triggers
3. **`repo_size_kb`** — single GET to `/repos/{owner}/{repo}` → `size` field (KB). Already possible via `github_service`. Cache per `repo_name`.
4. **`src_file_count`** — `GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1` → count non-config, non-doc files by extension
5. **`has_lockfile`** — scan tree for `package-lock.json`, `yarn.lock`, `go.sum`, `Gemfile.lock`, `Cargo.lock`, `poetry.lock`

**New `code_complexity` formula** (composite, backward-compatible):
```python
code_complexity = (
    0.4 * log1p(repo_size_kb) +
    0.3 * log1p(src_file_count) +
    0.2 * log1p(run_command_line_count) +
    0.1 * has_lockfile
)
```

When `repo_size_kb` is unavailable (YAML-only cold start): fall back to `run_command_line_count` only.

**Files to change:**
- `workflow_parser.py` → `extract_workflow_features()` calls `github_service.get_repo_metadata()`
- `feature_extractor.py` → add `run_command_line_count`, `workflow_trigger_is_pr` extraction
- `engine.py` → update `MODEL_FEATURE_NAMES` to replace dropped features + add new ones

---

### A4 — Backend Engine Update (`engine.py`)

```python
MODEL_FEATURE_NAMES = [
    "yaml_line_count", "yaml_depth", "job_count", "total_steps",
    "avg_steps_per_job", "uses_matrix_strategy", "matrix_permutations",
    "os_label",               # now median-target encoded at inference
    "timeout_minutes", "unique_actions_used", "is_using_setup_actions",
    "is_using_cache", "env_var_count", "needs_dependencies_count",
    "code_complexity",        # composite: repo_size_kb + src_file_count + run_lines
    "primary_language",       # mean-target encoded at inference
    "run_command_line_count", # new
    "workflow_trigger_is_pr", # new
]
```

Add encoding maps (loaded from saved notebook artifacts):
```python
OS_TARGET_ENCODING = {"macos": 1.94, "windows": 1.23, "ubuntu": 0.87, "self-hosted": 1.1}
LANG_TARGET_ENCODING = {...}  # saved from notebook
```

Back-transform: already uses `expm1` — confirm this is applied after `predict()`.

Add `requirements.txt` entry: `lightgbm==4.5.0`

---

## Part B — Auth Fix

### B1 — Root Cause

The `PredictionHistory` component calls `getPredictionHistory()` which hits `/api/predictions/history` — **a public, unscoped endpoint** returning all users' predictions. There is a `/api/predictions/me` endpoint that correctly filters by `user.id`, but it's never called from the UI.

The `Dashboard` component also calls `getPredictionHistory()` instead of `getMyPredictions()`.

### B2 — Frontend Fixes

**`PredictionHistory.jsx`:**
- Import `useAuth` hook
- When `isAuthenticated`: call `getMyPredictions(page, pageSize)` → `/api/predictions/me`
- When not authenticated: show a "Sign in to see your predictions" gate (or show global with disclaimer)
- Add a `user.full_name` greeting at the top of the history page

**`Dashboard.jsx`:**
- When `isAuthenticated`: replace `getPredictionHistory(1, 5)` with `getMyPredictions(1, 5)` for the recent predictions section
- Add user's personal stats: total spend, total predictions (user-scoped)
- When NOT authenticated: show landing hero + public model status only

**`api.js`:**
- `getMyPredictions` already exists and is correct — just needs to be called

### B3 — Backend Additions

**New `/api/predictions/stats` endpoint** (for dashboard charts):
```python
@router.get("/stats/me")
async def get_my_stats(user: User = Depends(get_current_user), ...):
    # Returns:
    # - total_predictions, total_cost_usd, avg_duration, avg_cost
    # - cost_by_repo: [{repo_name, total_cost, count}]
    # - cost_over_time: [{date, total_cost}] last 30 days
    # - top_runner: most used runner_type
    # - savings_tip: repo with highest avg cost (actionable insight)
```

Add `schemas.py` entries for `UserStatsResponse`.

---

## Part C — Frontend Redesign

### C1 — Color Scheme: GitHub Dark + Teal Glow

**`tailwind.config.js` — new colors:**
```js
colors: {
  gh: {
    canvas: '#0d1117',      // page background
    surface: '#161b22',     // card background
    border: '#30363d',      // borders
    text: '#c9d1d9',        // primary text
    muted: '#8b949e',       // secondary text
    blue: '#58a6ff',        // links, primary accent
    green: '#3fb950',       // success, cost positive
    orange: '#f0883e',      // warnings, duration
    red: '#f85149',         // errors
    teal: '#39d0d8',        // glow accent (from reference image)
  },
  glow: {
    teal: 'rgba(57,208,216,0.15)',
    blue: 'rgba(88,166,255,0.15)',
    green: 'rgba(63,185,80,0.15)',
  }
}
```

Force dark mode as **default** (not toggleable to light — the reference image is dark-only). Remove `ThemeContext` light/dark toggle or keep it as a secondary option.

**`index.css`:** Rewrite all component classes using `gh-*` colors. Add glow card class:
```css
.glow-card {
  @apply bg-gh-surface border border-gh-border rounded-xl p-6;
  box-shadow: 0 0 0 1px theme('colors.gh.border'),
              0 8px 24px rgba(0,0,0,0.4);
}
.glow-card-teal {
  box-shadow: 0 0 24px theme('colors.glow.teal'),
              0 1px 0 theme('colors.gh.border');
}
```

---

### C2 — Layout Redesign (`Layout.jsx`)

Inspired by the reference image's **left sidebar + top header** layout:

```
┌──────────────────────────────────────────────────────┐
│  HEADER: Logo  |  Search bar  |  User avatar + name  │
├────────┬─────────────────────────────────────────────┤
│        │                                             │
│  SIDE  │          MAIN CONTENT AREA                 │
│  BAR   │                                             │
│        │                                             │
│ Dash   │                                             │
│ Pred   │                                             │
│ History│                                             │
│ Pricing│                                             │
│        │                                             │
└────────┴─────────────────────────────────────────────┘
```

- Sidebar: `w-56` fixed left, dark `gh-surface` background, active item highlighted with teal left border + teal text
- Header: `gh-canvas` background, user avatar circle with initials, dropdown menu (Profile / Sign out)
- Mobile: hamburger collapses sidebar to overlay drawer
- Remove top-nav-only layout

---

### C3 — Dashboard Redesign (`Dashboard.jsx`)

**When authenticated** (full personal dashboard):

```
┌── Greeting ─────────────────────────────────────────────────┐
│  "Good morning, Atharv"   [Run New Prediction →]            │
└─────────────────────────────────────────────────────────────┘

┌── 4 KPI Cards ──────────────────────────────────────────────┐
│  Total Predictions  │  Total Spent  │  Avg Duration  │  Repos│
│  [teal glow card]   │  [green glow] │  [orange glow] │  [blue]│
└─────────────────────────────────────────────────────────────┘

┌── Cost Over Time (Line Chart) ──┬── Cost by Repo (Bar) ──────┐
│  30-day rolling, recharts       │  Top 5 repos by total cost  │
│  teal line with glow area fill  │  horizontal bars, gh-green  │
└─────────────────────────────────┴─────────────────────────────┘

┌── Recent Predictions Table ─────────────────────────────────┐
│  Repo | Workflow | Runner | Duration | Cost | Date          │
│  (user-scoped, last 5)                                      │
└─────────────────────────────────────────────────────────────┘

┌── Savings Insight Panel ────────────────────────────────────┐
│  "Your most expensive repo is X — avg $0.08/run             │
│   Consider caching dependencies to save ~30%"               │
└─────────────────────────────────────────────────────────────┘
```

**When NOT authenticated:**
- Hero landing section only (existing content, restyled)
- CTA to sign in / register
- Model status badge

---

### C4 — New Pages

**`ProfilePage.jsx`** (`/profile` route):
- User info: name, email, member since
- Change password form (uses existing `/api/auth/reset-password`)
- Account stats summary (same data as KPI cards)
- Danger zone: (placeholder) delete account

**`AnalyticsPage.jsx`** (`/analytics` route):
- Full-page charts view
- Cost over time (filterable: 7d / 30d / 90d / all)
- Duration distribution histogram (recharts)
- Runner OS breakdown (pie chart)
- Language breakdown (horizontal bar)
- Prediction frequency heatmap (calendar grid, optional)

---

### C5 — Auth Pages Restyling

`LoginPage.jsx` and `RegisterPage.jsx`:
- Dark `gh-canvas` background with centered card
- Card: `gh-surface` with `gh-border`, teal accent on focus
- GitHub-style "Sign in to GHA Cost Predictor" header with Octocat-inspired icon
- Remove light-mode specific classes

---

## Implementation Order (Step-by-Step)

### Step 1 — Fix Notebooks (offline, Colab)
- [ ] Apply median-target encoding to `os_label` + `primary_language` in `03_` and `04_`
- [ ] Drop 5 Tier-3 features in both notebooks
- [ ] Verify XGB notebook runs on full 196K dataset
- [ ] Add `run_command_line_count` + `workflow_trigger_is_pr` features to both notebooks
- [ ] Re-export `rf_model.joblib` and `xgb_model.joblib`

### Step 2 — Create `05_lightgbm_regression.ipynb`
- [ ] Build full LightGBM pipeline (A2 above)
- [ ] Add SHAP analysis
- [ ] Export `lgb_model.joblib` to `backend/ml_models/`

### Step 3 — Backend Feature Extractor
- [ ] `feature_extractor.py`: add `run_command_line_count`, `workflow_trigger_is_pr`
- [ ] `workflow_parser.py`: call `github_service.get_repo_size()` when repo context available
- [ ] Add `get_repo_metadata()` method to `github_service.py`
- [ ] Update `WorkflowFeatures` schema in `schemas.py`

### Step 4 — Backend Engine + Auth
- [ ] `engine.py`: update `MODEL_FEATURE_NAMES`, add target encoding maps, fix back-transform
- [ ] `requirements.txt`: add `lightgbm==4.5.0`
- [ ] `predictions.py`: add `/stats/me` endpoint
- [ ] `schemas.py`: add `UserStatsResponse`
- [ ] Verify `/api/predictions/me` works correctly (it does — just needs frontend wiring)

### Step 5 — Frontend: Theme
- [ ] `tailwind.config.js`: add `gh.*` and `glow.*` color scales
- [ ] `index.css`: rewrite component classes with GitHub palette + glow cards
- [ ] Set dark mode as default in `ThemeContext.jsx`

### Step 6 — Frontend: Layout
- [ ] `Layout.jsx`: replace top-nav with sidebar + header layout
- [ ] Add `ProfilePage.jsx` route
- [ ] Add `AnalyticsPage.jsx` route
- [ ] Update `App.jsx` with new routes

### Step 7 — Frontend: Dashboard
- [ ] `Dashboard.jsx`: full rewrite with auth-conditional content
- [ ] Add `useMyStats()` custom hook calling `/api/predictions/stats/me`
- [ ] Wire recharts line + bar charts

### Step 8 — Frontend: Auth Pages + History
- [ ] `PredictionHistory.jsx`: call `getMyPredictions()` when authenticated
- [ ] `Dashboard.jsx`: use `getMyPredictions(1, 5)` for recent table
- [ ] Restyle `LoginPage.jsx` + `RegisterPage.jsx` with GitHub theme

### Step 9 — New Pages
- [ ] `ProfilePage.jsx`
- [ ] `AnalyticsPage.jsx`

### Step 10 — Integration Testing
- [ ] Verify auth flow: register → login → history shows user's data
- [ ] Verify dashboard charts load correctly
- [ ] Verify LightGBM model loads in `engine.py` and predictions work
- [ ] Verify feature extraction with repo metadata

---

## Key Bug: Auth Scoping

**Root cause in `PredictionHistory.jsx` line 39:**
```js
// WRONG — global unscoped endpoint
const resp = await getPredictionHistory(page, pageSize, filters);
```
**Fix:**
```js
// When authenticated, use user-scoped endpoint
const resp = isAuthenticated
  ? await getMyPredictions(page, pageSize)
  : await getPredictionHistory(page, pageSize, filters);
```

**Root cause in `Dashboard.jsx` line 26:**
```js
// WRONG — global unscoped
getPredictionHistory(1, 5).catch(() => ({ items: [], total: 0 })),
```
**Fix:**
```js
// Use user-scoped when available
(isAuthenticated ? getMyPredictions(1, 5) : getPredictionHistory(1, 5))
  .catch(() => ({ items: [], total: 0 })),
```

---

## Expected Outcomes

| Metric | Current | After Part A |
|---|---|---|
| R² (log) | 0.748 RF / 0.691 XGB | ~0.82–0.86 LightGBM |
| R² (original) | 0.667 / 0.608 | ~0.76–0.82 |
| MAPE | 179% / 143% | ~40–70% |
| MAE | 1.09 / 0.86 min | ~0.6–0.8 min |

| Feature | Before | After Parts B+C |
|---|---|---|
| Auth scoping | History shows all users' data | Fully per-user |
| Dashboard | Simple stat cards + table | Full analytics with charts |
| UI theme | Indigo/purple generic | GitHub dark + teal glow |
| Navigation | Top navbar only | Sidebar + header |
| Analytics | None | Cost trends, repo breakdown |
