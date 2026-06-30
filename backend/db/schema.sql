-- ============================================================
-- Starline Connectors — Inventory Management System
-- Database Schema (PostgreSQL / Google Cloud SQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'inventory_manager',
    'qc_inspector',
    'production_manager',
    'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_stage AS ENUM (
    'inventory_entry',
    'qc_incoming',
    'production',
    'qc_outgoing',
    'finished_goods'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE item_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'in_progress'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE invoice_status AS ENUM (
    'draft',
    'issued',
    'paid',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLE: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150)        NOT NULL,
  email         VARCHAR(255)        NOT NULL UNIQUE,
  password_hash VARCHAR(255)        NOT NULL,
  role          user_role           NOT NULL DEFAULT 'inventory_manager',
  is_active     BOOLEAN             NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);

-- ============================================================
-- TABLE: inventory_items
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
  id              SERIAL PRIMARY KEY,
  item_name       VARCHAR(255)        NOT NULL,
  sku             VARCHAR(100),
  quantity        NUMERIC(12, 4)      NOT NULL DEFAULT 0,
  unit            VARCHAR(50)         NOT NULL DEFAULT 'pcs',
  received_date   DATE                NOT NULL DEFAULT CURRENT_DATE,
  status          item_status         NOT NULL DEFAULT 'pending',
  current_stage   item_stage          NOT NULL DEFAULT 'inventory_entry',
  supplier_name   VARCHAR(255),
  batch_number    VARCHAR(100),
  notes           TEXT,
  created_by      INTEGER             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_stage   ON inventory_items(current_stage);
CREATE INDEX IF NOT EXISTS idx_inventory_status  ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_created ON inventory_items(created_by);

-- ============================================================
-- TABLE: stage_history
-- ============================================================
CREATE TABLE IF NOT EXISTS stage_history (
  id          SERIAL PRIMARY KEY,
  item_id     INTEGER             NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  from_stage  item_stage,
  to_stage    item_stage          NOT NULL,
  status      item_status         NOT NULL,
  comments    TEXT,
  changed_by  INTEGER             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stage_history_item ON stage_history(item_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_date ON stage_history(changed_at);

-- ============================================================
-- TABLE: finished_goods
-- ============================================================
CREATE TABLE IF NOT EXISTS finished_goods (
  id                  SERIAL PRIMARY KEY,
  item_id             INTEGER             NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity            NUMERIC(12, 4)      NOT NULL,
  approved_date       DATE                NOT NULL DEFAULT CURRENT_DATE,
  ready_for_invoice   BOOLEAN             NOT NULL DEFAULT TRUE,
  batch_reference     VARCHAR(150),
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finished_goods_item    ON finished_goods(item_id);
CREATE INDEX IF NOT EXISTS idx_finished_goods_invoice ON finished_goods(ready_for_invoice);

-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                  SERIAL PRIMARY KEY,
  invoice_number      VARCHAR(50)         NOT NULL UNIQUE,
  customer_name       VARCHAR(255)        NOT NULL,
  customer_address    TEXT                NOT NULL,
  customer_gstin      VARCHAR(20),
  customer_state      VARCHAR(100)        NOT NULL,
  invoice_date        DATE                NOT NULL DEFAULT CURRENT_DATE,
  subtotal            NUMERIC(14, 2)      NOT NULL DEFAULT 0,
  cgst                NUMERIC(14, 2)      NOT NULL DEFAULT 0,
  sgst                NUMERIC(14, 2)      NOT NULL DEFAULT 0,
  igst                NUMERIC(14, 2)      NOT NULL DEFAULT 0,
  total_amount        NUMERIC(14, 2)      NOT NULL DEFAULT 0,
  pdf_url             TEXT,
  pdf_gcs_path        VARCHAR(500),
  status              invoice_status      NOT NULL DEFAULT 'draft',
  created_by          INTEGER             NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_number   ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status   ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date     ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_name);

-- ============================================================
-- TABLE: invoice_line_items
-- ============================================================
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id              SERIAL PRIMARY KEY,
  invoice_id      INTEGER             NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id         INTEGER             REFERENCES inventory_items(id) ON DELETE SET NULL,
  description     VARCHAR(500)        NOT NULL,
  hsn_code        VARCHAR(20),
  quantity        NUMERIC(12, 4)      NOT NULL,
  unit_price      NUMERIC(14, 2)      NOT NULL,
  gst_rate        NUMERIC(5, 2)       NOT NULL DEFAULT 18.00,
  line_total      NUMERIC(14, 2)      NOT NULL,
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message           TEXT                NOT NULL,
  related_item_id   INTEGER             REFERENCES inventory_items(id) ON DELETE SET NULL,
  is_read           BOOLEAN             NOT NULL DEFAULT FALSE,
  notification_type VARCHAR(50)         NOT NULL DEFAULT 'stage_change',
  created_at        TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users',
    'inventory_items',
    'finished_goods',
    'invoices'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I;
       CREATE TRIGGER set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();',
      t, t
    );
  END LOOP;
END $$;

-- ============================================================
-- SEED: Default admin user (password: Admin@1234)
-- Change this password immediately after first login!
-- ============================================================
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'System Admin',
  'admin@starlineconnectors.com',
  '$2b$10$rQmK8YJxQvD3Fz1e5KJ.A.oZsXqTcHn4bW3PJdHYk5m7vCuQ2KyuO',
  'admin'
)
ON CONFLICT (email) DO NOTHING;
