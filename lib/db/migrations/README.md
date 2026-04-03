# Database Migrations

## Strategy

This project uses two complementary approaches for schema management:

- **drizzle-kit push** — primary approach for development and staging (syncs schema without migration files)
- **SQL migration files** — for production deployments, auditing, and structured rollouts

## Migration files

### `0000_neat_maddog.sql` — Full baseline (fresh databases only)
Creates all 12 tables from scratch. Use only for **brand-new databases** with no existing schema.

### `0001_phase4_ai_tables.sql` — Phase 4 incremental (existing databases)
Adds only `ai_generations` and `meal_feedback` tables (introduced in Phase 4 / KI layer).
Uses `CREATE TABLE IF NOT EXISTS` so it is **safe to run on existing databases** that were
provisioned via `drizzle-kit push`.

## Deployment guide

### Fresh environment (new database)
```bash
# Option A — apply baseline migration
pnpm --filter @workspace/db run migrate

# Option B — push schema directly (recommended for development)
pnpm --filter @workspace/db run push
```

### Existing environment (upgrading to Phase 4)
```bash
# Apply only the Phase 4 incremental migration
psql "$DATABASE_URL" -f lib/db/migrations/0001_phase4_ai_tables.sql

# Or use push to sync schema safely
pnpm --filter @workspace/db run push
```

## Generating new migrations

When you add new tables or columns, regenerate via:
```bash
pnpm --filter @workspace/db run generate
```

This updates the drizzle-managed migration chain (adds a new versioned SQL file).
