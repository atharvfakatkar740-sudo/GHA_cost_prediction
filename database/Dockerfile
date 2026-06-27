# ── Modular PostgreSQL image for GHA Cost Predictor ──────────────────────────
# Bundles the database engine + bootstrap defaults so the published image is
# entirely self-contained and version-pinned alongside the backend/frontend.
FROM postgres:16-alpine

# Sensible defaults baked in (override at runtime with -e / compose env)
ENV POSTGRES_DB=gha_cost_predictor \
    POSTGRES_USER=postgres \
    POSTGRES_PASSWORD=postgres

# Any *.sql / *.sh placed here is executed once on first container start
# (only when the data directory is empty).
COPY initdb/ /docker-entrypoint-initdb.d/

EXPOSE 5432
