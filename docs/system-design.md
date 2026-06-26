4.1 System Architecture 

Overview 

The GHA Cost Predictor system follows a microservices architecture with clear separation of concerns between frontend, backend API, ML components, and external integrations. The system is designed to be scalable, maintainable, and highly available. 

Architecture Components 

Frontend Layer 

React Application: Single-page application with component-based architecture 

State Management: Local state management with React hooks 

UI Framework: Tailwind CSS with responsive design 

Build Tools: Webpack/Vite for optimization and bundling 

Backend API Layer 

FastAPI Framework: High-performance async web framework 

RESTful API: REST endpoints for all system operations 

Authentication: JWT-based authentication with bcrypt password hashing 

Middleware: CORS, rate limiting, request logging, and error handling 

ML Prediction Engine 

Feature Extraction: 21-feature pipeline from workflow YAML analysis 

Model Inference: XGBoost/RandomForest models with fallback heuristics 

Hot-reloading: Runtime model updates without system restart 

Confidence Scoring: Prediction reliability assessment 

Data Layer 

PostgreSQL Database: Primary data storage with async connections 

Connection Pooling: SQLAlchemy async session management 

Caching Layer: Redis for pricing data and session storage 

JSON Storage: Complex feature data storage in JSON columns 

External Integrations 

GitHub API: Repository access, webhook processing, comment posting 

Email Service: Google SMTP for password reset and notifications 

Pricing Service: Live GitHub Actions runner pricing updates 

System Architecture Diagram 

 

Deployment Architecture 

Containerization: Docker containers for all services 

Orchestration: Kubernetes or Docker Compose for service management 

Load Balancing: Nginx or cloud load balancer 

SSL Termination: HTTPS enforcement at load balancer level 

Auto-scaling: Horizontal scaling based on load metrics 

4.2 Mathematical Model 

ML Prediction Model 

Feature Vector Definition 

The system extracts 21 structured features from GitHub Actions workflow YAML: 

Structural Features: 

yaml_line_count: Total lines in workflow YAML 

yaml_depth: Maximum nesting depth 

job_count: Number of jobs defined 

total_steps: Total steps across all jobs 

avg_steps_per_job: Average steps per job 

Matrix Strategy Features: 

uses_matrix_strategy: Binary indicator (0/1) 

matrix_dimensions: Number of matrix dimensions 

matrix_permutations: Total matrix combinations 

fail_fast: Binary indicator for fail-fast setting 

Execution Features: 

os_label: Categorical encoding of runner OS 

timeout_minutes: Maximum timeout across jobs 

unique_actions_used: Count of distinct GitHub Actions 

is_using_setup_actions: Binary indicator 

is_using_docker_actions: Binary indicator 

is_using_cache: Binary indicator 

Complexity Features: 

env_var_count: Total environment variables 

if_condition_count: Conditional logic count 

needs_dependencies_count: Job dependencies 

code_complexity: Weighted complexity score 

primary_language: Repository's primary language 

has_container: Container usage indicator 

Prediction Algorithm 

The duration prediction follows this mathematical formulation: 

Predicted_Duration = f(X) + ε 
 
Where: 
- X = [x₁, x₂, ..., x₂₁] is the feature vector 
- f() is the trained ML model (XGBoost/RandomForest) 
- ε is the prediction error term 
 

Cost Calculation Model 

Total_Cost = ceil(Predicted_Duration_Minutes) × Per_Minute_Rate 
 
Where: 
- Per_Minute_Rate varies by runner type: 
 * Linux (standard): $0.008/minute 
 * Windows (standard): $0.016/minute 
 * macOS (standard): $0.080/minute 
 * Linux ARM: $0.005/minute 
 

Confidence Score Calculation 

Confidence = Base_Confidence + Feature_Adjustments 
 
Where: 
- Base_Confidence = 0.75 
- Feature_Adjustments = ±0.05 to ±0.15 based on: 
 * Step count (>3: +0.05, >10: +0.05) 
 * Matrix strategy usage: -0.10 
 * Docker usage: -0.05 
 * Container usage: -0.05 
 

Heuristic Fallback Model 

When ML models are unavailable: 

Duration_Heuristic = (Steps × 0.35 × OS_Multiplier) +  
                   (Jobs × 0.25) + 0.6 +  
                   Adjustments 
 
Where OS_Multiplier: 
- Linux: 1.0 
- Windows: 1.4 
- macOS: 1.6 
