"""
Generate a sample XGBoost model for testing/demo purposes.
This script creates a synthetic dataset based on realistic GitHub Actions
workflow features and trains both XGBoost and RandomForest models.

If you have your own trained model, place it at:
  backend/ml_models/model.joblib

The model must accept a feature vector of 20 features (see FEATURE_NAMES).
"""

import os
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor
from sklearn.ensemble import RandomForestRegressor

DATASET_COLUMNS = [
    "total_cost_usd",
    "duration_minutes",
    "repo_name",
    "head_sha",
    "workflow_name",
    "yaml_line_count",
    "yaml_depth",
    "job_count",
    "total_steps",
    "avg_steps_per_job",
    "uses_matrix_strategy",
    "matrix_dimensions",
    "matrix_permutations",
    "fail_fast",
    "os_label",
    "container_image",
    "timeout_minutes",
    "unique_actions_used",
    "is_using_setup_actions",
    "is_using_docker_actions",
    "is_using_cache",
    "env_var_count",
    "if_condition_count",
    "needs_dependencies_count",
    "code_complexity",
    "primary_language",
]


MODEL_FEATURES = [c for c in DATASET_COLUMNS if c not in ("duration_minutes",)]


def generate_synthetic_data(n_samples: int = 5000, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic training data that mimics real GitHub Actions workflows.
    Duration is computed from a realistic formula with noise.
    """
    rng = np.random.RandomState(seed)

    repos = ["octo-org/demo", "acme/api", "acme/web", "open-source/lib"]
    workflows = ["CI", "Build", "Tests", "Release", "Lint"]
    os_labels = ["ubuntu-latest", "windows-latest", "macos-latest"]
    languages = ["Python", "JavaScript", "TypeScript", "Go", "Java"]
    containers = ["", "python:3.11", "node:20", "golang:1.22"]

    job_count = rng.randint(1, 8, n_samples)
    total_steps = rng.randint(2, 40, n_samples)

    uses_matrix = rng.binomial(1, 0.28, n_samples)
    matrix_dimensions = np.where(uses_matrix == 1, rng.randint(1, 4, n_samples), 0)
    matrix_permutations = np.where(uses_matrix == 1, rng.randint(2, 20, n_samples), 0)
    fail_fast = np.where(uses_matrix == 1, rng.binomial(1, 0.4, n_samples), 0)

    is_using_cache = rng.binomial(1, 0.42, n_samples)
    is_using_setup_actions = rng.binomial(1, 0.62, n_samples)
    is_using_docker_actions = rng.binomial(1, 0.22, n_samples)

    env_var_count = rng.randint(0, 25, n_samples)
    if_condition_count = rng.randint(0, 12, n_samples)
    needs_dependencies_count = rng.randint(0, 8, n_samples)

    yaml_line_count = rng.randint(40, 450, n_samples)
    yaml_depth = rng.randint(2, 18, n_samples)

    timeout_minutes = rng.choice([0, 0, 0, 5, 10, 15, 30, 45, 60], n_samples)
    unique_actions_used = rng.randint(1, 25, n_samples)

    avg_steps_per_job = (total_steps / np.maximum(job_count, 1)).round(4)

    code_complexity = (
        job_count * 1.0
        + total_steps * 0.35
        + yaml_depth * 0.75
        + matrix_permutations * 0.15
        + needs_dependencies_count * 0.6
        + if_condition_count * 0.25
        + env_var_count * 0.05
        + is_using_docker_actions * 2.0
        + is_using_cache * 0.5
    ).round(4)

    df = pd.DataFrame({
        "total_cost_usd": np.zeros(n_samples, dtype=float),
        "duration_minutes": np.zeros(n_samples, dtype=float),
        "repo_name": rng.choice(repos, n_samples),
        "head_sha": ["".join(rng.choice(list("0123456789abcdef"), 40)) for _ in range(n_samples)],
        "workflow_name": rng.choice(workflows, n_samples),
        "yaml_line_count": yaml_line_count,
        "yaml_depth": yaml_depth,
        "job_count": job_count,
        "total_steps": total_steps,
        "avg_steps_per_job": avg_steps_per_job,
        "uses_matrix_strategy": uses_matrix,
        "matrix_dimensions": matrix_dimensions,
        "matrix_permutations": matrix_permutations,
        "fail_fast": fail_fast,
        "os_label": rng.choice(os_labels, n_samples, p=[0.70, 0.20, 0.10]),
        "container_image": rng.choice(containers, n_samples, p=[0.78, 0.10, 0.08, 0.04]),
        "timeout_minutes": timeout_minutes,
        "unique_actions_used": unique_actions_used,
        "is_using_setup_actions": is_using_setup_actions,
        "is_using_docker_actions": is_using_docker_actions,
        "is_using_cache": is_using_cache,
        "env_var_count": env_var_count,
        "if_condition_count": if_condition_count,
        "needs_dependencies_count": needs_dependencies_count,
        "code_complexity": code_complexity,
        "primary_language": rng.choice(languages, n_samples),
    })

    os_mult = (
        np.where(df["os_label"].str.contains("ubuntu"), 1.0,
        np.where(df["os_label"].str.contains("windows"), 1.4, 1.6))
    )

    base = (
        0.6
        + df["total_steps"] * 0.32 * os_mult
        + df["job_count"] * 0.25
        + df["is_using_setup_actions"] * 0.6
        + df["is_using_docker_actions"] * 2.2
        + (df["matrix_permutations"] > 1).astype(int) * 0.8
        + df["code_complexity"] * 0.02
    )

    base = base * np.where(df["is_using_cache"] == 1, 0.85, 1.0)

    noise = rng.normal(1.0, 0.15, n_samples)
    noise = np.clip(noise, 0.6, 1.6)
    df["duration_minutes"] = (base * noise).round(2).clip(lower=0.5)

    per_min_cost = (
        np.where(df["os_label"].str.contains("ubuntu"), 0.008,
        np.where(df["os_label"].str.contains("windows"), 0.016, 0.02))
    )
    df["total_cost_usd"] = (df["duration_minutes"] * per_min_cost).round(4)

    return df[DATASET_COLUMNS]


def train_and_save(output_dir: str = None):
    """Train models and save the best one."""
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))

    print("Generating synthetic training data...")
    df = generate_synthetic_data(n_samples=8000)

    X = df[MODEL_FEATURES]
    y = df["duration_minutes"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"Training set: {len(X_train)} | Test set: {len(X_test)}")
    print()

    categorical_features = [
        "repo_name",
        "head_sha",
        "workflow_name",
        "os_label",
        "container_image",
        "primary_language",
    ]
    numeric_features = [c for c in MODEL_FEATURES if c not in categorical_features]

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
            ("num", "passthrough", numeric_features),
        ],
        remainder="drop",
    )

    # ── XGBoost ─────────────────────────────────────────────────
    print("Training XGBoost...")
    xgb = Pipeline(steps=[
        ("preprocess", preprocessor),
        ("model", XGBRegressor(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
        )),
    ])
    xgb.fit(X_train, y_train)
    xgb_pred = xgb.predict(X_test)

    print(f"  MAE:  {mean_absolute_error(y_test, xgb_pred):.3f}")
    print(f"  RMSE: {np.sqrt(mean_squared_error(y_test, xgb_pred)):.3f}")
    print(f"  R²:   {r2_score(y_test, xgb_pred):.4f}")
    print()

    # ── Random Forest ───────────────────────────────────────────
    print("Training Random Forest...")
    rf = Pipeline(steps=[
        ("preprocess", preprocessor),
        ("model", RandomForestRegressor(
            n_estimators=300,
            max_depth=10,
            random_state=42,
            n_jobs=-1,
        )),
    ])
    rf.fit(X_train, y_train)
    rf_pred = rf.predict(X_test)

    print(f"  MAE:  {mean_absolute_error(y_test, rf_pred):.3f}")
    print(f"  RMSE: {np.sqrt(mean_squared_error(y_test, rf_pred)):.3f}")
    print(f"  R²:   {r2_score(y_test, rf_pred):.4f}")
    print()

    # ── Select best model ───────────────────────────────────────
    xgb_mae = mean_absolute_error(y_test, xgb_pred)
    rf_mae = mean_absolute_error(y_test, rf_pred)

    if xgb_mae <= rf_mae:
        best_model = xgb
        best_name = "XGBRegressor"
    else:
        best_model = rf
        best_name = "RandomForestRegressor"

    print(f"Best model: {best_name}")

    # Save
    model_path = os.path.join(output_dir, "model.joblib")
    joblib.dump(best_model, model_path)
    print(f"Saved to: {model_path}")

    # Also save both models separately
    joblib.dump(xgb, os.path.join(output_dir, "xgboost_model.joblib"))
    joblib.dump(rf, os.path.join(output_dir, "random_forest_model.joblib"))
    print("Saved individual models too.")

    return model_path


if __name__ == "__main__":
    train_and_save()
