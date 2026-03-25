import os
import logging
import numpy as np
import joblib
from typing import Optional, Dict, Any

from app.ml.feature_extractor import features_to_array, FEATURE_NAMES
from app.models.schemas import WorkflowFeatures

logger = logging.getLogger(__name__)


class PredictionEngine:
    """
    Loads a pre-trained ML model (XGBoost / RandomForest / etc.)
    and predicts workflow duration in minutes from extracted features.
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
                self.model_name = type(self.model).__name__
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

    def predict_duration(self, features: WorkflowFeatures) -> Dict[str, Any]:
        """
        Predict workflow duration in minutes.
        Returns dict with predicted_minutes, model_used, confidence.
        """
        feature_array = np.array([features_to_array(features)])

        if self.model is not None:
            return self._predict_with_model(feature_array, features)
        else:
            return self._predict_heuristic(features)

    def _predict_with_model(self, feature_array: np.ndarray, features: WorkflowFeatures) -> Dict[str, Any]:
        """Use the loaded ML model for prediction."""
        try:
            prediction = self.model.predict(feature_array)[0]
            predicted_minutes = max(0.5, float(prediction))

            confidence = self._estimate_confidence(features)

            return {
                "predicted_minutes": round(predicted_minutes, 2),
                "model_used": self.model_name,
                "confidence": round(confidence, 2),
            }
        except Exception as e:
            logger.error(f"Model prediction failed: {e}, falling back to heuristic")
            return self._predict_heuristic(features)

    def _predict_heuristic(self, features: WorkflowFeatures) -> Dict[str, Any]:
        """
        Heuristic fallback estimator based on workflow structure.
        Uses empirical averages from GitHub Actions usage data.
        """
        # Base time per step (empirical avg ~0.4 min/step for simple steps)
        base_per_step = 0.4

        # OS multiplier (Windows/macOS tend to take longer)
        os_multipliers = {0: 1.0, 1: 1.4, 2: 1.6}
        os_mult = os_multipliers.get(features.runner_os_encoded, 1.0)

        # Step-based estimate
        step_time = features.total_steps * base_per_step * os_mult

        # Docker overhead
        if features.has_docker:
            step_time += 2.0

        # Services overhead
        if features.has_services:
            step_time += 1.5

        # Cache typically saves time
        if features.has_cache:
            step_time *= 0.85

        # Matrix multiplier (parallel, so take max duration, not sum)
        if features.has_matrix and features.matrix_combinations > 1:
            # Assume longest job ≈ 1.2x single job (some variance)
            step_time *= 1.2

        # Setup actions add overhead
        if features.has_setup_action:
            step_time += 0.5

        # Complexity adjustment
        complexity_factor = 1.0 + (features.estimated_complexity / 50.0)
        step_time *= min(complexity_factor, 2.5)

        predicted = max(1.0, step_time)

        return {
            "predicted_minutes": round(predicted, 2),
            "model_used": "heuristic",
            "confidence": 0.55,
        }

    def _estimate_confidence(self, features: WorkflowFeatures) -> float:
        """Estimate prediction confidence based on feature completeness."""
        confidence = 0.75

        # More steps = more data points = slightly higher confidence
        if features.total_steps > 3:
            confidence += 0.05
        if features.total_steps > 10:
            confidence += 0.05

        # Matrix makes prediction less certain
        if features.has_matrix:
            confidence -= 0.1

        # Docker/services add uncertainty
        if features.has_docker:
            confidence -= 0.05
        if features.has_services:
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
            "feature_names": FEATURE_NAMES,
            "feature_count": len(FEATURE_NAMES),
        }
