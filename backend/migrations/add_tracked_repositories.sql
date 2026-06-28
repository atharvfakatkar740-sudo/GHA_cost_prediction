-- Migration: Add tracked_repositories table
-- Date: 2026-06-28
-- Description: Enables per-repository webhook tracking and cost analytics

CREATE TABLE IF NOT EXISTS tracked_repositories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repo_owner VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    webhook_secret VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_event_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT (NOW() AT TIME ZONE 'UTC')
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracked_repos_user_id ON tracked_repositories(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_repos_owner_name ON tracked_repositories(repo_owner, repo_name);
CREATE INDEX IF NOT EXISTS idx_tracked_repos_active ON tracked_repositories(is_active) WHERE is_active = TRUE;

-- Unique constraint to prevent duplicate tracking
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracked_repos_unique ON tracked_repositories(user_id, repo_owner, repo_name);

-- Comments
COMMENT ON TABLE tracked_repositories IS 'User-tracked repositories with webhook configuration';
COMMENT ON COLUMN tracked_repositories.webhook_secret IS 'Per-repository webhook secret (40-char hex)';
COMMENT ON COLUMN tracked_repositories.last_event_at IS 'Timestamp of most recent webhook event';
