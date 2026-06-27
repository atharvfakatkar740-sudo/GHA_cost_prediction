-- ── First-boot bootstrap for GHA Cost Predictor database ─────────────────────
-- Runs only once, when the postgres data directory is empty.
-- The application (FastAPI/SQLAlchemy) creates/migrates its own tables on
-- startup, so this file is intentionally minimal and exists to guarantee the
-- target database + useful extensions are present in the bundled image.

-- Ensure the target database exists (created automatically from POSTGRES_DB,
-- this is a defensive no-op kept for clarity / manual runs).
SELECT 'database ready' AS status;

-- Commonly useful extensions for analytics / fuzzy search.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
