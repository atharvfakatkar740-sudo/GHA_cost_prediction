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
from xgboost import XGBRegressor
from sklearn.ensemble import RandomForestRegressor

FEATURE_NAMES = [
    "num_jobs", "total_steps", "runner_os_encoded",
    "has_matrix", "matrix_combinations", "has_cache", "has_artifacts",
    "num_env_vars", "has_services", "has_timeout",
    "num_uses_actions", "num_run_commands", "has_conditional",
    "trigger_count", "has_checkout", "has_setup_action",
    "has_docker", "estimated_complexity", "max_parallel_jobs",
    "has_needs_dependency",
]


def generate_synthetic_data(n_samples: int = 5000, seed: int = 42) -> pd.DataFrame:
    """
    Generate synthetic training data that mimics real GitHub Actions workflows.
    Duration is computed from a realistic formula with noise.
    """
    rng = np.random.RandomState(seed)

    data = {
        "num_jobs": rng.randint(1, 8, n_samples),
        "total_steps": rng.randint(2, 30, n_samples),
        "runner_os_encoded": rng.choice([0, 1, 2], n_samples, p=[0.65, 0.25, 0.10]),
        "has_matrix": rng.binomial(1, 0.25, n_samples),
        "matrix_combinations": np.zeros(n_samples, dtype=int),
        "has_cache": rng.binomial(1, 0.4, n_samples),
        "has_artifacts": rng.binomial(1, 0.3, n_samples),
        "num_env_vars": rng.randint(0, 15, n_samples),
        "has_services": rng.binomial(1, 0.15, n_samples),
        "has_timeout": rng.binomial(1, 0.2, n_samples),
        "num_uses_actions": rng.randint(1, 12, n_samples),
        "num_run_commands": rng.randint(1, 15, n_samples),
        "has_conditional": rng.binomial(1, 0.3, n_samples),
        "trigger_count": rng.randint(1, 5, n_samples),
        "has_checkout": rng.binomial(1, 0.9, n_samples),
        "has_setup_action": rng.binomial(1, 0.6, n_samples),
        "has_docker": rng.binomial(1, 0.2, n_samples),
        "max_parallel_jobs": rng.randint(1, 6, n_samples),
        "has_needs_dependency": rng.binomial(1, 0.35, n_samples),
    }

    # Matrix combinations only when has_matrix=1
    for i in range(n_samples):
        if data["has_matrix"][i]:
            data["matrix_combinations"][i] = rng.randint(2, 12)

    # Compute estimated_complexity
    data["estimated_complexity"] = (
        data["num_jobs"] * 1.0
        + data["total_steps"] * 0.5
        + data["matrix_combinations"] * 0.8
        + data["has_docker"] * 2.0
        + data["has_services"] * 1.5
        + data["num_run_commands"] * 0.3
        + data["num_uses_actions"] * 0.2
        + data["has_cache"] * 0.5
        + data["has_artifacts"] * 0.5
    ).round(2)

    df = pd.DataFrame(data)

    # ── Generate realistic duration_minutes (target) ────────────
    os_mult = np.where(df["runner_os_encoded"] == 0, 1.0,
              np.where(df["runner_os_encoded"] == 1, 1.4, 1.6))

    base = (
        0.5  # startup overhead
        + df["total_steps"] * 0.35 * os_mult
        + df["num_run_commands"] * 0.2
        + df["has_docker"] * 2.5
        + df["has_services"] * 1.8
        + df["has_setup_action"] * 0.6
        + df["has_artifacts"] * 0.4
        + df["matrix_combinations"] * 0.5
    )

    # Cache saves ~15% time
    base = base * np.where(df["has_cache"] == 1, 0.85, 1.0)

    # Add noise (±20%)
    noise = rng.normal(1.0, 0.15, n_samples)
    noise = np.clip(noise, 0.6, 1.6)

    df["duration_minutes"] = (base * noise).round(2)
    df["duration_minutes"] = df["duration_minutes"].clip(lower=0.5)

    return df


def train_and_save(output_dir: str = None):
    """Train models and save the best one."""
    if output_dir is None:
        output_dir = os.path.dirname(os.path.abspath(__file__))

    print("Generating synthetic training data...")
    df = generate_synthetic_data(n_samples=8000)

    X = df[FEATURE_NAMES]
    y = df["duration_minutes"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"Training set: {len(X_train)} | Test set: {len(X_test)}")
    print()

    # ── XGBoost ─────────────────────────────────────────────────
    print("Training XGBoost...")
    xgb = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        n_jobs=-1,
    )
    xgb.fit(X_train, y_train)
    xgb_pred = xgb.predict(X_test)

    print(f"  MAE:  {mean_absolute_error(y_test, xgb_pred):.3f}")
    print(f"  RMSE: {np.sqrt(mean_squared_error(y_test, xgb_pred)):.3f}")
    print(f"  R²:   {r2_score(y_test, xgb_pred):.4f}")
    print()

    # ── Random Forest ───────────────────────────────────────────
    print("Training Random Forest...")
    rf = RandomForestRegressor(
        n_estimators=300,
        max_depth=10,
        random_state=42,
        n_jobs=-1,
    )
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
