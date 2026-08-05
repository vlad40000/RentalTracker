BEGIN;

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY,
  owner_key text NOT NULL UNIQUE,
  property_count_target integer NOT NULL CHECK (property_count_target > 0),
  portfolio_unit_type text NOT NULL CHECK (portfolio_unit_type IN ('single-family','multi-unit','mixed')),
  phone_access_required boolean NOT NULL,
  historical_import_months integer NOT NULL CHECK (historical_import_months >= 0),
  setup_completed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS properties (
  id uuid PRIMARY KEY,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  region text NOT NULL,
  postal_code text NOT NULL,
  purchase_date date,
  purchase_price_cents bigint CHECK (purchase_price_cents IS NULL OR purchase_price_cents >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text
);

CREATE TABLE IF NOT EXISTS units (
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  name text NOT NULL,
  bedrooms numeric(4,1),
  bathrooms numeric(4,1),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text,
  UNIQUE(property_id, name)
);

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text
);

CREATE TABLE IF NOT EXISTS leases (
  id uuid PRIMARY KEY,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date,
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  deposit_contract_cents bigint NOT NULL DEFAULT 0 CHECK (deposit_contract_cents >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','ended')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS lease_tenants (
  id uuid PRIMARY KEY,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE RESTRICT,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text,
  UNIQUE(lease_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS lease_rent_terms (
  id uuid PRIMARY KEY,
  lease_id uuid NOT NULL REFERENCES leases(id) ON DELETE RESTRICT,
  effective_from date NOT NULL,
  effective_through date,
  rent_cents bigint NOT NULL CHECK (rent_cents > 0),
  due_day integer NOT NULL CHECK (due_day BETWEEN 1 AND 28),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_reason text,
  CHECK (effective_through IS NULL OR effective_through >= effective_from),
  UNIQUE(lease_id, effective_from)
);

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY,
  filename text NOT NULL,
  status text NOT NULL CHECK (status IN ('committed','reversed','failed')),
  imported_rows integer NOT NULL DEFAULT 0 CHECK (imported_rows >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reverse_reason text
);

CREATE TABLE IF NOT EXISTS charges (
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  lease_id uuid REFERENCES leases(id) ON DELETE RESTRICT,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  charge_type text NOT NULL CHECK (charge_type IN ('rent','late_fee','repair_chargeback','adjustment','reversal')),
  description text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  effective_date date NOT NULL,
  due_date date NOT NULL,
  generation_key text UNIQUE,
  reverses_charge_id uuid UNIQUE REFERENCES charges(id) ON DELETE RESTRICT,
  reversal_reason text,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((reverses_charge_id IS NULL AND reversal_reason IS NULL) OR (reverses_charge_id IS NOT NULL AND reversal_reason IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  tenant_id uuid REFERENCES tenants(id) ON DELETE RESTRICT,
  payer_name text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  received_date date NOT NULL,
  method text NOT NULL CHECK (method IN ('cash','check','ach','card','money_order','zelle','venmo','other')),
  reference text,
  notes text,
  reverses_payment_id uuid UNIQUE REFERENCES payments(id) ON DELETE RESTRICT,
  reversal_reason text,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((reverses_payment_id IS NULL AND reversal_reason IS NULL) OR (reverses_payment_id IS NOT NULL AND reversal_reason IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id uuid PRIMARY KEY,
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  charge_id uuid NOT NULL REFERENCES charges(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  reverses_allocation_id uuid UNIQUE REFERENCES payment_allocations(id) ON DELETE RESTRICT,
  reversal_reason text,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((reverses_allocation_id IS NULL AND reversal_reason IS NULL) OR (reverses_allocation_id IS NOT NULL AND reversal_reason IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  unit_id uuid REFERENCES units(id) ON DELETE RESTRICT,
  category text NOT NULL,
  description text NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents <> 0),
  expense_date date NOT NULL,
  vendor text,
  receipt_blob_url text,
  reverses_expense_id uuid UNIQUE REFERENCES expenses(id) ON DELETE RESTRICT,
  reversal_reason text,
  import_batch_id uuid REFERENCES import_batches(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((reverses_expense_id IS NULL AND reversal_reason IS NULL) OR (reverses_expense_id IS NOT NULL AND reversal_reason IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS export_runs (
  id uuid PRIMARY KEY,
  export_version integer NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual','scheduled')),
  json_blob_url text,
  csv_blob_url text,
  checksum text NOT NULL,
  status text NOT NULL CHECK (status IN ('complete','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_property ON units(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_leases_unit ON leases(unit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_charges_due ON charges(due_date, property_id);
CREATE INDEX IF NOT EXISTS idx_payments_received ON payments(received_date, property_id);
CREATE INDEX IF NOT EXISTS idx_allocations_charge ON payment_allocations(charge_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date, property_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_charge ON charges(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_payment ON payments(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_expense ON expenses(import_batch_id);

CREATE OR REPLACE FUNCTION prevent_financial_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Posted financial records are append-only. Create a reversal entry instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS charges_append_only ON charges;
CREATE TRIGGER charges_append_only BEFORE UPDATE OR DELETE ON charges
FOR EACH ROW EXECUTE FUNCTION prevent_financial_mutation();

DROP TRIGGER IF EXISTS payments_append_only ON payments;
CREATE TRIGGER payments_append_only BEFORE UPDATE OR DELETE ON payments
FOR EACH ROW EXECUTE FUNCTION prevent_financial_mutation();

DROP TRIGGER IF EXISTS allocations_append_only ON payment_allocations;
CREATE TRIGGER allocations_append_only BEFORE UPDATE OR DELETE ON payment_allocations
FOR EACH ROW EXECUTE FUNCTION prevent_financial_mutation();

DROP TRIGGER IF EXISTS expenses_append_only ON expenses;
CREATE TRIGGER expenses_append_only BEFORE UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION prevent_financial_mutation();

COMMIT;
