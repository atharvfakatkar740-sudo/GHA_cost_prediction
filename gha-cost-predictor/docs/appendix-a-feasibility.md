# Appendix A: Problem Feasibility Analysis

---

## A.1 Problem Statement (Formal Definition)

Let a GitHub Actions workflow be represented as a structured YAML document $W$. The system extracts a feature vector:

$$\mathbf{x} = [x_1, x_2, \ldots, x_n] \in \mathbb{R}^n, \quad n = 18$$

from $W$, where features include `yaml_line_count`, `job_count`, `total_steps`, `matrix_permutations`, `os_label` (target-encoded), `code_complexity` (log-weighted composite), `primary_language` (target-encoded), and others.

**Core prediction problem:** Learn a function $f : \mathbb{R}^{18} \to \mathbb{R}_{>0}$ such that:

$$\hat{d} = f(\mathbf{x}), \quad \text{then} \quad \hat{C} = \lceil \hat{d} \rceil \times r_{os}$$

where $\hat{d}$ is the predicted duration in minutes, $\hat{C}$ is the estimated cost in USD, and $r_{os}$ is the per-minute runner rate for the detected OS.

---

## A.2 Complexity Class Analysis

### A.2.1 Feature Extraction — Class P

The feature extraction pipeline (`workflow_parser.py`, `feature_extractor.py`) performs a single-pass parse of the workflow YAML tree.

Let $J$ = number of jobs, $S_j$ = steps in job $j$, $D$ = YAML nesting depth.

**Time complexity:**

$$T_{\text{extract}} = O\!\left(D \cdot \sum_{j=1}^{J} S_j\right) = O(D \cdot S_{\text{total}})$$

Since $D$, $J$, and $S_{\text{total}}$ are all bounded by the finite size of the YAML document $|W|$:

$$T_{\text{extract}} = O(|W|^2) \subseteq \mathbf{P}$$

The matrix permutation count uses a multiplicative product over dimension sizes:

$$\pi = \prod_{k=1}^{K} |D_k| + |\text{include}| - |\text{exclude}|$$

This is $O(K)$ where $K$ is the number of matrix dimensions — also $\in \mathbf{P}$.

The composite complexity feature is computed as:

$$c = 0.4\ln(1 + s_{\text{repo}}) + 0.3\ln(1 + l_{\text{run}}) + 0.15\ln(1 + S) + 0.1\ln(1 + D) + 0.05\ln(1 + N)$$

Each $\ln(1+\cdot)$ term is $O(1)$, so the full feature vector construction is $O(|W|)$.

**Verdict: Feature extraction ∈ P.**

---

### A.2.2 ML Inference — Class P

The trained models (XGBoost, RandomForest, LightGBM) perform inference on a fixed-size row $\mathbf{x} \in \mathbb{R}^{18}$.

**Random Forest:** Traverses $T$ trees of depth at most $h$:

$$T_{\text{RF}} = O(T \cdot h) = O(1) \quad \text{(fixed model, fixed input dimension)}$$

**XGBoost / LightGBM (Gradient Boosted Trees):** $B$ boosting rounds, each tree of depth $h$:

$$T_{\text{GBM}} = O(B \cdot h) = O(1)$$

Both are constant-time operations relative to inference input size since the model is pre-trained and the feature dimension is fixed at 18. Categorical features (`os_label`, `primary_language`) are resolved via dictionary lookup in $O(1)$ using pre-computed target-encoding maps (`OS_TARGET_ENCODING`, `LANG_TARGET_ENCODING`).

**Verdict: ML inference ∈ P.**

---

### A.2.3 Cost Calculation — Class P

$$\hat{C} = \lceil \hat{d} \rceil \times r_{os}$$

The ceiling function and scalar multiplication are $O(1)$.

Per-job cost breakdown iterates once over $J$ jobs: $O(J)$.

**Verdict: Cost calculation ∈ P.**

---

### A.2.4 Webhook & Repository Scanning — Class P

Scanning a repository for workflow files requires fetching the file tree from the GitHub API. If the repository has $F$ files, the scan is $O(F)$ — linear in the repository size. Each changed workflow file triggers an independent prediction pipeline (also $\mathbf{P}$). No combinatorial search or exhaustive enumeration is performed.

**Verdict: Repository scanning ∈ P.**

---

### A.2.5 Optimal Runner Selection — NP-Hard (Excluded from Scope)

A natural extension of the problem would be: *given a workflow with $J$ jobs and $R$ available runner types with different cost-rate/speed tradeoffs, assign a runner to each job to minimise total cost while satisfying deadline constraints.*

This is a variant of the **Scheduling on Unrelated Machines** problem:

- Minimise $\sum_{j=1}^{J} \lceil d_j(r_j) \rceil \times \text{rate}(r_j)$ subject to deadline $T_{\max}$
- This reduces from **3-Partition** and is known to be **NP-Hard** in the strong sense (Garey & Johnson, 1979)

**This sub-problem is explicitly out of scope.** The current system uses the detected runner OS from the YAML directly — a $O(J)$ lookup — avoiding NP-Hard territory entirely.

---

## A.3 Satisfiability Analysis

### A.3.1 Feature Completeness (SAT Encoding)

The prediction is satisfiable (produces a valid output) if and only if the following propositional constraints hold:

Let boolean variables $b_i$ represent required feature availability:

| Variable | Condition |
|---|---|
| $b_1$ | YAML is parseable (valid syntax) |
| $b_2$ | At least 1 job exists ($J \geq 1$) |
| $b_3$ | Runner OS is identifiable from `runs-on` |
| $b_4$ | ML model is loaded OR heuristic fallback is active |
| $b_5$ | Pricing rate $r_{os} > 0$ is available |

**Satisfiability condition:**

$$\phi = b_1 \wedge b_2 \wedge b_3 \wedge (b_4) \wedge b_5$$

Since $b_4$ is a disjunction (ML model OR heuristic), it is always **true** by construction — the `PredictionEngine` guarantees fallback via `_predict_heuristic()`. Pricing defaults exist for all OS types. Therefore:

$$\phi \equiv b_1 \wedge b_2 \wedge b_3 \wedge \top \wedge \top = b_1 \wedge b_2 \wedge b_3$$

The system is **satisfiable for any syntactically valid workflow with at least one job and an identifiable runner**. Invalid YAML returns an empty feature vector and falls back to heuristic with default values — the system never enters an unsatisfiable state.

**Verdict: The prediction problem is always satisfiable (trivially, via guaranteed fallback).**

---

### A.3.2 2-SAT Structure in Confidence Scoring

The confidence adjustment logic in `engine.py` has a pure additive structure with independent boolean conditions:

$$\text{conf} = 0.75 + 0.05 \cdot [S > 3] + 0.05 \cdot [S > 10] - 0.10 \cdot [M] - 0.05 \cdot [Do] - 0.05 \cdot [Co]$$

where $[S > 3]$, $[M]$, $[Do]$, $[Co]$ are boolean indicators for step count, matrix strategy, Docker, and container usage respectively. Each clause is independent — no clause depends on negation of another — making this a **Horn clause** formula, solvable in $O(n)$ linear time (a strict subset of 2-SAT).

---

## A.4 Complexity Summary

| Sub-problem | Complexity Class | Justification |
|---|---|---|
| YAML feature extraction | **P** — $O(\|W\|^2)$ | Single-pass tree traversal |
| Matrix permutation count | **P** — $O(K)$ | Product over dimension sizes |
| Code complexity score | **P** — $O(1)$ | Fixed log-weighted formula |
| Target encoding (OS, language) | **P** — $O(1)$ | Dictionary lookup |
| ML inference (XGBoost / RF / LGB) | **P** — $O(T \cdot h)$ | Fixed model, fixed 18-dim input |
| Cost calculation | **P** — $O(J)$ | Scalar arithmetic per job |
| Repository workflow scan | **P** — $O(F)$ | Linear file tree traversal |
| Confidence scoring | **P** — $O(1)$ | Horn clause, linear time |
| Optimal runner assignment | **NP-Hard** | Reduces from 3-Partition (out of scope) |

---

## A.5 Feasibility Conclusion

**The GHA Cost Predictor problem, as implemented, is fully tractable and belongs to class P.**

All core operations — YAML parsing, feature extraction, ML inference, and cost calculation — run in polynomial time with respect to workflow size. The system avoids NP-Hard sub-problems (such as optimal runner scheduling) by design: it uses deterministic feature extraction and pre-trained model lookup rather than combinatorial search.

The satisfiability analysis confirms the system always produces a valid prediction output for any syntactically valid GitHub Actions workflow, guaranteed by the heuristic fallback chain. This makes the problem both **computationally feasible** and **practically deployable** at scale.

---

*References: Garey, M.R. & Johnson, D.S. (1979). Computers and Intractability: A Guide to the Theory of NP-Completeness. W.H. Freeman.*
