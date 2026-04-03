# Database Migrations

## Strategy

This project uses two complementary approaches for schema management:

- **drizzle-kit push** — primary approach for development and staging (syncs schema without migration files)
- **SQL migration files** — for production deployments, auditing, and structured rollouts

## Migration files

### `0000_neat_maddog.sql` — Full baseline (fresh databases only)
Creates all 12 tables from scratch. Use only for **brand-new databases** with no existing schema.

### `0001_phase4_ai_tables.sql` — Phase 4 incremental (existing databases)
Adds `ai_generations` and `meal_feedback` tables (introduced in Phase 4 / KI layer).
Includes:
- `CREATE TABLE IF NOT EXISTS` for both tables
- Foreign keys: `meal_feedback.meal_entry_id → meal_entries.id` (ON DELETE SET NULL)
- Foreign keys: `meal_feedback.recipe_id → recipes.id` (ON DELETE SET NULL)
- Check constraint: `meal_feedback.rating IN ('thumbs_up', 'neutral', 'thumbs_down')`
- Indexes on `user_id`, `type`, `created_at` (ai_generations) and `user_id`, `meal_entry_id`, `recipe_id` (meal_feedback)
- FK additions use `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object` — idempotent and safe to re-run.

**Important:** Do NOT apply `0001` after `0000` on a fresh database — the baseline already includes the AI tables.

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
