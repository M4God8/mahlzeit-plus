-- Migration: Household Sharing Phase 1
-- Adds households and household_members tables, extends shopping_lists and shopping_list_items

CREATE TABLE IF NOT EXISTS households (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  invite_code TEXT UNIQUE,
  invite_code_expires_at TIMESTAMPTZ,
  max_members INTEGER NOT NULL DEFAULT 6,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS household_members (
  id SERIAL PRIMARY KEY,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE shopping_lists ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id);
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE shopping_list_items ADD COLUMN IF NOT EXISTS completed_by TEXT;

CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_household ON shopping_lists(household_id);
