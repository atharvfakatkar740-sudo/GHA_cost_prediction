import os
import logging
import math
import numpy as np
import pandas as pd
import joblib
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# Feature names the trained model expects (matches training notebook column order)
# Kept backward-compatible: old 21-feature models still work via fallback column selection
MODEL_FEATURE_NAMES = [
    "yaml_line_count", "yaml_depth", "job_count", "total_steps",
    "avg_steps_per_job", "uses_matrix_strategy", "matrix_permutations",
    "os_label", "timeout_minutes", "unique_actions_used",
    "is_using_setup_actions", "is_using_cache", "env_var_count",
    "needs_dependencies_count", "code_complexity", "primary_language",
    "run_command_line_count", "workflow_trigger_is_pr",
]

# Legacy 21-feature set (for models trained before the upgrade)
MODEL_FEATURE_NAMES_LEGACY = [
    "yaml_line_count", "yaml_depth", "job_count", "total_steps",
    "avg_steps_per_job", "uses_matrix_strategy", "matrix_dimensions",
    "matrix_permutations", "fail_fast", "os_label", "timeout_minutes",
    "unique_actions_used", "is_using_setup_actions", "is_using_docker_actions",
    "is_using_cache", "env_var_count", "if_condition_count",
    "needs_dependencies_count", "code_complexity", "primary_language",
    "has_container",
]

# Median-target encoding for os_label (fitted on training data log1p(duration))
# macos >> windows >> ubuntu — reflects actual billing multipliers
OS_TARGET_ENCODING: Dict[str, float] = {
    "macos": 1.94,
    "macos-latest": 1.94,
    "macos-13": 1.94,
    "macos-14": 1.94,
    "windows": 1.31,
    "windows-latest": 1.31,
    "windows-2022": 1.31,
    "ubuntu": 0.87,
    "ubuntu-latest": 0.87,
    "ubuntu-22.04": 0.87,
    "ubuntu-20.04": 0.87,
    "self-hosted": 1.10,
}

# Mean-target encoding for primary_language (fitted on training data)
LANG_TARGET_ENCODING: Dict[str, float] = {
    "swift": 2.21, "kotlin": 2.05, "scala": 2.01, "java": 1.98,
    "c++": 1.89, "rust": 1.85, "go": 1.72, "haskell": 1.68,
    "c#": 1.65, "c": 1.61, "ruby": 1.55, "python": 1.42,
    "typescript": 1.38, "javascript": 1.31, "php": 1.28, "r": 1.25,
    "elixir": 1.22, "clojure": 1.19, "dart": 1.15, "shell": 1.10,
    "html": 0.98, "unknown": 1.20,
}
_LANG_DEFAULT = 1.20

# Keys in the feature dict that are metadata, not model inputs
_META_KEYS = {
    "total_cost_usd", "duration_minutes", "repo_name", "head_sha",
    "workflow_name", "matrix_dimensions", "fail_fast", "if_condition_count",
    "has_container", "is_using_docker_actions", "repo_size_kb",
}


class PredictionEngine:
    """
    Loads a pre-trained ML model (sklearn Pipeline / XGBoost / RandomForest)
    and predicts workflow duration in minutes from 21 extracted features.
    Falls back to a heuristic estimator if no model file is available.
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model = None
        self.model_name = "heuristic"
        self.model_path = model_path
        self._load_model()

    def _load_model(self):
        """Attempt to load a saved model from disk."""
        if self.model_path and os.path.isfile(self.model_path):
            try:
                self.model = joblib.load(self.model_path)
                # Pipeline wraps the real estimator
                inner = self.model
                if hasattr(inner, "named_steps"):
                    inner = list(inner.named_steps.values())[-1]
                self.model_name = type(inner).__name__
                logger.info(f"Loaded ML model: {self.model_name} from {self.model_path}")
            except Exception as e:
                logger.warning(f"Failed to load model from {self.model_path}: {e}")
                self.model = None
                self.model_name = "heuristic"
        else:
            logger.info("No model file found. Using heuristic estimator.")

    def reload_model(self, model_path: Optional[str] = None):
        """Hot-reload the model at runtime."""
        if model_path:
            self.model_path = model_path
        self._load_model()

    def predict_duration(self, feature_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict workflow duration in minutes from the 21-feature dict
        produced by extract_workflow_features().
        Returns dict with predicted_minutes, model_used, confidence.
        """
        if self.model is not None:
            return self._predict_with_model(feature_dict)
        else:
            return self._predict_heuristic(feature_dict)

    def _encode_features(self, feature_dict: Dict[str, Any], feature_names: list) -> Dict[str, Any]:
        """Apply target encoding to categorical features and return clean row dict."""
        row = {}
        for k in feature_names:
            if k == "os_label":
                raw = str(feature_dict.get("os_label", "ubuntu-latest")).lower()
                # Match partial keys (e.g. "ubuntu-22.04" → "ubuntu-22.04" or fallback)
                encoded = OS_TARGET_ENCODING.get(raw)
                if encoded is None:
                    for key, val in OS_TARGET_ENCODING.items():
                        if key in raw:
                            encoded = val
                            break
                row[k] = encoded if encoded is not None else 0.87
            elif k == "primary_language":
                lang = str(feature_dict.get("primary_language", "unknown")).lower()
                row[k] = LANG_TARGET_ENCODING.get(lang, _LANG_DEFAULT)
            else:
                row[k] = feature_dict.get(k, 0)
        return row

    def _predict_with_model(self, feature_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Build a single-row DataFrame and call model.predict()."""
        try:
            # Try new feature set first, fall back to legacy if model was trained on old features
            for feature_names in (MODEL_FEATURE_NAMES, MODEL_FEATURE_NAMES_LEGACY):
                try:
                    row = self._encode_features(feature_dict, feature_names)
                    df = pd.DataFrame([row], columns=feature_names)
                    raw_prediction = self.model.predict(df)[0]
                    break
                except Exception:
                    continue
            else:
                raise ValueError("Both feature sets failed")

            # Model may predict in log1p space — back-transform if value looks like log scale
            if raw_prediction < 6.0:
                predicted_minutes = max(0.5, float(math.expm1(raw_prediction)))
            else:
                predicted_minutes = max(0.5, float(raw_prediction))

            confidence = self._estimate_confidence(feature_dict)
            return {
                "predicted_minutes": round(predicted_minutes, 2),
                "model_used": self.model_name,
                "confidence": round(confidence, 2),
            }
        except Exception as e:
            logger.error(f"Model prediction failed: {e}, falling back to heuristic")
            return self._predict_heuristic(feature_dict)

    def _predict_heuristic(self, f: Dict[str, Any]) -> Dict[str, Any]:
        """
        Heuristic fallback estimator based on workflow structure.
        """
        os_label = f.get("os_label", "ubuntu-latest")
        os_mult = 1.4 if "windows" in os_label else (1.6 if "macos" in os_label else 1.0)

        step_time = f.get("total_steps", 1) * 0.35 * os_mult
        step_time += f.get("job_count", 1) * 0.25
        step_time += 0.6  # startup overhead

        if f.get("is_using_docker_actions"):
            step_time += 2.2
        if f.get("has_container"):
            step_time += 1.5
        if f.get("is_using_cache"):
            step_time *= 0.85
        if f.get("uses_matrix_strategy") and f.get("matrix_permutations", 0) > 1:
            step_time *= 1.2
        if f.get("is_using_setup_actions"):
            step_time += 0.6

        complexity = f.get("code_complexity", 0)
        step_time *= min(1.0 + complexity / 50.0, 2.5)
        predicted = max(1.0, step_time)

        return {
            "predicted_minutes": round(predicted, 2),
            "model_used": "heuristic",
            "confidence": 0.55,
        }

    def _estimate_confidence(self, f: Dict[str, Any]) -> float:
        confidence = 0.75
        if f.get("total_steps", 0) > 3:
            confidence += 0.05
        if f.get("total_steps", 0) > 10:
            confidence += 0.05
        if f.get("uses_matrix_strategy"):
            confidence -= 0.1
        if f.get("is_using_docker_actions"):
            confidence -= 0.05
        if f.get("has_container"):
            confidence -= 0.05
        return max(0.3, min(0.95, confidence))

    @property
    def is_model_loaded(self) -> bool:
        return self.model is not None

    @property
    def info(self) -> Dict[str, Any]:
        return {
            "model_name": self.model_name,
            "model_loaded": self.is_model_loaded,
            "model_path": self.model_path,
            "feature_names": MODEL_FEATURE_NAMES,
            "feature_count": len(MODEL_FEATURE_NAMES),
            "encoding": "median_target",
        }
