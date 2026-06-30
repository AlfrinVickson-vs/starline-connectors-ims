-- Migration: Add variant column to inventory_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_items' AND column_name = 'variant'
  ) THEN
    ALTER TABLE inventory_items
      ADD COLUMN variant VARCHAR(100);
  END IF;
END $$;
