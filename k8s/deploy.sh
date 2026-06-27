#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# deploy.sh  —  Build images and deploy GHA Cost Predictor to Kubernetes
#
# Usage:
#   ./k8s/deploy.sh [--tag v1.2.3] [--skip-build]
#
# Requirements:
#   • docker
#   • kubectl (context pointing at your cluster / minikube / kind)
#   • (Optional) minikube — script auto-detects and uses its docker env
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="${IMAGE_TAG:-latest}"
SKIP_BUILD="${SKIP_BUILD:-false}"

BACKEND_IMAGE="gha-cost-predictor/backend:${IMAGE_TAG}"
FRONTEND_IMAGE="gha-cost-predictor/frontend:${IMAGE_TAG}"

# ── Parse args ────────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag) IMAGE_TAG="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# ── If using minikube, point docker CLI at its daemon so images are available
if command -v minikube &>/dev/null && minikube status &>/dev/null 2>&1; then
  echo ">>> Detected minikube — using minikube docker env"
  eval "$(minikube docker-env)"
fi

# ── Build Docker images ────────────────────────────────────────────────────────
if [[ "${SKIP_BUILD}" == "false" ]]; then
  echo ">>> Building backend image: ${BACKEND_IMAGE}"
  docker build -t "${BACKEND_IMAGE}" "${ROOT_DIR}/backend"

  echo ">>> Building frontend image: ${FRONTEND_IMAGE}"
  docker build \
    --build-arg REACT_APP_API_URL="/api" \
    -t "${FRONTEND_IMAGE}" \
    "${ROOT_DIR}/frontend"
else
  echo ">>> Skipping image build (--skip-build)"
fi

# ── Apply Kubernetes manifests in order ────────────────────────────────────────
echo ">>> Applying Kubernetes manifests..."
kubectl apply -f "${SCRIPT_DIR}/00-namespace.yaml"
kubectl apply -f "${SCRIPT_DIR}/01-configmap.yaml"
kubectl apply -f "${SCRIPT_DIR}/02-secrets.yaml"
kubectl apply -f "${SCRIPT_DIR}/03-postgres.yaml"
kubectl apply -f "${SCRIPT_DIR}/04-backend.yaml"
kubectl apply -f "${SCRIPT_DIR}/05-frontend.yaml"
kubectl apply -f "${SCRIPT_DIR}/06-ingress.yaml"

# ── Wait for rollouts ──────────────────────────────────────────────────────────
echo ">>> Waiting for postgres rollout..."
kubectl rollout status deployment/postgres  -n gha-cost-predictor --timeout=120s

echo ">>> Waiting for backend rollout..."
kubectl rollout status deployment/backend   -n gha-cost-predictor --timeout=120s

echo ">>> Waiting for frontend rollout..."
kubectl rollout status deployment/frontend  -n gha-cost-predictor --timeout=120s

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo " GHA Cost Predictor deployed successfully!"
echo "═══════════════════════════════════════════════════"
echo ""
echo " Pods:"
kubectl get pods -n gha-cost-predictor
echo ""
echo " Access (Ingress host: gha.local):"
echo "   Add '127.0.0.1  gha.local' to /etc/hosts, then:"
echo "   Frontend  → http://gha.local"
echo "   API docs  → http://gha.local/api/docs"
echo ""
echo " Or use port-forward for quick local access:"
echo "   kubectl port-forward svc/frontend-svc 3000:80 -n gha-cost-predictor"
echo "   kubectl port-forward svc/backend-svc  8000:8000 -n gha-cost-predictor"
