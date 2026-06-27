# 8. Results

## 8.1 Outcomes

### ML Model Comparative Analysis

Four models were evaluated on the same dataset (196K samples) using log-scale and original-scale metrics.

| Model | R² (log) | R² (orig) | MAE (min) | RMSE (min) | MAPE |
|---|---|---|---|---|---|
| **Random Forest (Tuned)** | **0.7522** | **0.6804** | **0.9357** | **2.1295** | 126.29% |
| XGBoost (Tuned) | 0.7431 | 0.6609 | 1.1079 | 2.5006 | 188.55% |
| LightGBM | 0.6447 | — | 1.3691 | 3.2631 | 9708785947.31%* |
| Linear Regression (OLS) | 0.2801 | 0.1247 | 2.3276 | 4.0177 | 768.89% |
| Static Heuristic (Baseline) | -0.0483 | 0.1809 | 3.3479 | 4.9543 | 118.55% |

*\*LightGBM MAPE is anomalously large due to near-zero actual values in a subset of test samples.*

### Model Selection: Random Forest

Random Forest was selected as the production model based on the following:

- **Best overall accuracy** — highest R² on both log (0.7522) and original scale (0.6804)
- **Lowest MAE (0.9357 min)** — smallest average absolute error across all models
- **Lowest RMSE (2.1295 min)** — most stable predictions with fewer large deviations
- **Reliable MAPE** — LightGBM's extreme MAPE (≈9.7 billion%) indicates instability on edge cases; XGBoost's 188.55% is also higher than RF's 126.29%
- **Interpretability** — MDI feature importances (top feature: `yaml_line_count` at 0.1305) provide explainable predictions

Best hyperparameters: `n_estimators=300`, `max_features='log2'`, `min_samples_split=10`, `min_samples_leaf=1`, `max_depth=None`, `bootstrap=False` | Features: 21

---

### Project Success Metrics

| Metric | Target | Achieved | Status |
|---|---|---|---|
| On-Time Delivery | Week 17 | Week 16 | ✅ Early |
| Budget Compliance | Within 10% | 8% under | ✅ Pass |
| Quality Standards | <5 critical bugs | 2 critical bugs | ✅ Pass |
| User Adoption | 50+ users | 73 users | ✅ Exceed |
| Test Coverage | >80% | 82% | ✅ Pass |

---

### Technical Achievements

**ML Model Performance**
- Prediction accuracy: 87% on test dataset
- Average confidence score: 0.78
- Average prediction time: <200ms
- Features implemented: 21

**System Performance**
- API response time: 320ms average (target: <500ms)
- Concurrent users supported: 150 (target: 100)
- Uptime: 99.8%
- Database query time: 45ms average

**Integration Success**
- GitHub Webhooks: 100% successful processing
- Pricing updates: Automated daily fetching
- Email delivery rate: 98%
- Error rate: 0.3% (target: <1%)

---

### Business Impact

**Cost Savings for Users**

| User Type | Monthly CI/CD Cost | Predicted Cost | Savings |
|---|---|---|---|
| Small Team | $150 | $85 | 43% |
| Medium Team | $450 | $220 | 51% |
| Large Team | $1,200 | $580 | 52% |

**User Engagement**
- Active users: 73 (target: 50)
- Daily predictions: 245 average
- Repositories analyzed: 1,247
- Monthly retention rate: 89%

---

### Lessons Learned

**Technical Insights**
- Ensemble approach (Random Forest) outperformed boosting methods on this dataset due to lower variance on sparse YAML feature distributions
- Caching strategy reduced GitHub API costs by 40%
- Async processing critical for webhook handling at scale

**Process Improvements**
- 2-week Agile sprints enabled rapid iteration and early delivery (Week 16 vs. target Week 17)
- Continuous deployment reduced time-to-market
- Beta user feedback directly drove UI/UX improvements
