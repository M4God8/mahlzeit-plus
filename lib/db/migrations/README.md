# Database Migrations

## Strategy

This project uses **drizzle-kit push** as the primary schema management approach for development and staging environments.

The migration files in this directory serve as documentation and support fresh database deployments.

## Migration files

- `0000_neat_maddog.sql` — Full baseline schema for **fresh/new databases**. Creates all 12 tables including the Phase-4 additions `ai_generations` and `meal_feedback`.

## Usage

### Fresh environments (new database)
```bash
pnpm --filter @workspace/db run migrate
```

### Existing environments (already provisioned via push)
```bash
pnpm --filter @workspace/db run push
```

Running `migrate` against an already-provisioned database will fail because the tables already exist. Use `push` to sync schema changes safely.

## Generating new migrations

When you add new tables or columns:
```bash
pnpm --filter @workspace/db run generate
```

This will create a new incremental migration file based on the diff between current schema and the last migration snapshot.
