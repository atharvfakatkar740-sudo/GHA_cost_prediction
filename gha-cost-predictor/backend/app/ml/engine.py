import os
import logging
import numpy as np
import pandas as pd
import joblib
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# The 21 features the trained model expects (order matters for non-Pipeline models)
MODEL_FEATURE_NAMES = [
    "yaml_line_count", "yaml_depth", "job_count", "total_steps",
    "avg_steps_per_job", "uses_matrix_strategy", "matrix_dimensions",
    "matrix_permutations", "fail_fast", "os_label", "timeout_minutes",
    "unique_actions_used", "is_using_setup_actions", "is_using_docker_actions",
    "is_using_cache", "env_var_count", "if_condition_count",
    "needs_dependencies_count", "code_complexity", "primary_language",
    "has_container",
]

# Keys in the extract_workflow_features dict that are metadata, not model inputs
_META_KEYS = {"total_cost_usd", "duration_minutes", "repo_name", "head_sha", "workflow_name"}


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

    def _predict_with_model(self, feature_dict: Dict[str, Any]) -> Dict[str, Any]:
        """Build a single-row DataFrame and call model.predict()."""
        try:
            row = {k: v for k, v in feature_dict.items() if k not in _META_KEYS}
            df = pd.DataFrame([row], columns=MODEL_FEATURE_NAMES)
            prediction = self.model.predict(df)[0]
            predicted_minutes = max(0.5, float(prediction))
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
        }
