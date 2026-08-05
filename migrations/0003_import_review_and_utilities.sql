BEGIN;

ALTER TABLE charges DROP CONSTRAINT IF EXISTS charges_charge_type_check;
ALTER TABLE charges ADD CONSTRAINT charges_charge_type_check
  CHECK (charge_type IN ('rent','utility','late_fee','repair_chargeback','adjustment','reversal'));

CREATE TABLE IF NOT EXISTS import_review_items (
  id uuid PRIMARY KEY,
  import_batch_id uuid NOT NULL REFERENCES import_batches(id) ON DELETE RESTRICT,
  issue_type text NOT NULL CHECK (issue_type IN ('rent_mismatch','occupancy','identity','invalid_date','balance_gap','other')),
  subject text NOT NULL,
  detail text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK ((status='open' AND resolved_at IS NULL) OR (status<>'open' AND resolved_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_import_review_batch_status ON import_review_items(import_batch_id,status,created_at);

COMMIT;
