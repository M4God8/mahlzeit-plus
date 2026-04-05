-- Migration: Add meal repeat support
-- Adds repeat_days and repeated_from_entry_id columns to meal_entries

ALTER TABLE meal_entries ADD COLUMN IF NOT EXISTS repeat_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE meal_entries ADD COLUMN IF NOT EXISTS repeated_from_entry_id INTEGER NULL;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'meal_entries_repeated_from_entry_id_fkey' 
    AND table_name = 'meal_entries'
  ) THEN
    ALTER TABLE meal_entries 
    ADD CONSTRAINT meal_entries_repeated_from_entry_id_fkey 
    FOREIGN KEY (repeated_from_entry_id) 
    REFERENCES meal_entries(id) 
    ON DELETE CASCADE;
  END IF;
END $$;
