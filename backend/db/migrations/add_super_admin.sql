-- Migration: Support Super Admin role and Company Settings table

-- 1. Add 'super_admin' to user_role ENUM type (run within transaction or check first)
-- Note: ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in older PG versions, 
-- but DO blocks or run separately is fine. We run it directly.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. Create company_settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id              INTEGER PRIMARY KEY DEFAULT 1,
  company_name    VARCHAR(255) NOT NULL DEFAULT 'Starline Connectors',
  company_address TEXT NOT NULL DEFAULT 'Plot No. 45, Industrial Area, Sector 5, Gandhinagar, Gujarat - 382010',
  company_email   VARCHAR(255) NOT NULL DEFAULT 'info@starlineconnectors.com',
  company_contact VARCHAR(255) NOT NULL DEFAULT '+91 98765 43210'
);

-- Ensure default row exists
INSERT INTO company_settings (id, company_name, company_address, company_email, company_contact)
VALUES (1, 'Starline Connectors', 'Plot No. 45, Industrial Area, Sector 5, Gandhinagar, Gujarat - 382010', 'info@starlineconnectors.com', '+91 98765 43210')
ON CONFLICT (id) DO NOTHING;

-- 3. Add current_session_id to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS current_session_id VARCHAR(255);
