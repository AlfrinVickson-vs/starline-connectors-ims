-- Migration: Add rejected_quantity column to inventory_items
-- Safe to run multiple times (uses DO $$ guard)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'rejected_quantity'
  ) THEN
    ALTER TABLE inventory_items
      ADD COLUMN rejected_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0;
  END IF;
END $$;
