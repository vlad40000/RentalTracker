BEGIN;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('cash','check','ach','card','money_order','zelle','venmo','other'));
COMMIT;
