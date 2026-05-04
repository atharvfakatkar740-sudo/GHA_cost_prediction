# 04 System Design

---

## 4.1 System Architecture

The GHA Cost Predictor follows a layered architecture with clear separation between the frontend, backend API, ML engine, data layer, and external integrations.

**Architecture Components**

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 18, Tailwind CSS, Vite | SPA with YAML editor, prediction UI, user dashboard |
| Backend API | FastAPI, async/await | REST endpoints, JWT auth, webhook handling, CORS, rate limiting |
| ML Engine | XGBoost / RandomForest / LightGBM, Joblib | 21-feature extraction, model inference, confidence scoring, heuristic fallback |
| Data Layer | PostgreSQL 14+, SQLAlchemy 2.0, Redis | Async DB connections, connection pooling, pricing cache |
| External | GitHub API, Google SMTP, GitHub Pricing docs | Repo access, webhook events, email notifications, live pricing |

**System Architecture Diagram**

<!-- DIAGRAM PLACEHOLDER: System Architecture -->

**Deployment Architecture**

- Docker containers for all services; Docker Compose for local, Kubernetes for production.
- Nginx reverse proxy with SSL termination and load balancing.
- Horizontal auto-scaling for the backend; Redis for shared pricing cache across instances.

---

## 4.2 Mathematical Model

### Feature Vector

The ML pipeline extracts **21 features** from workflow YAML, grouped as:

| Group | Features |
|---|---|
| Structural | `yaml_line_count`, `yaml_depth`, `job_count`, `total_steps`, `avg_steps_per_job` |
| Matrix Strategy | `uses_matrix_strategy`, `matrix_dimensions`, `matrix_permutations`, `fail_fast` |
| Execution | `os_label`, `timeout_minutes`, `unique_actions_used`, `is_using_setup_actions`, `is_using_docker_actions`, `is_using_cache` |
| Complexity | `env_var_count`, `if_condition_count`, `needs_dependencies_count`, `code_complexity`, `primary_language`, `has_container` |

### Prediction Algorithm

```
Predicted_Duration = f(X) + ε

Where:
  X = [x₁, x₂, ..., x₂₁]   feature vector
  f()                         trained ML model (XGBoost / RandomForest / LightGBM)
  ε                           prediction error term
```

### Cost Calculation

```
Total_Cost = ceil(Predicted_Duration_min) × Per_Minute_Rate

Per_Minute_Rate:
  Linux (standard)  →  $0.008 / min
  Windows           →  $0.016 / min
  macOS             →  $0.080 / min
  Linux ARM         →  $0.005 / min
```

### Confidence Score

```
Confidence = 0.75 + Adjustments

Adjustments:
  steps > 3          →  +0.05
  steps > 10         →  +0.05
  matrix strategy    →  -0.10
  Docker usage       →  -0.05
  container usage    →  -0.05
```

### Heuristic Fallback (no ML model)

```
Duration_Heuristic = (steps × 0.35 × OS_Multiplier) + (jobs × 0.25) + 0.6

OS_Multiplier:  Linux → 1.0 | Windows → 1.4 | macOS → 1.6
```
