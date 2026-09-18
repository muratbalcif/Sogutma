-- One PENDING bank-transfer claim per payment (closes TOCTOU on findFirst+create).
-- APPROVED/REJECTED rows are excluded so sequential/partial claims remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "bank_transfer_notifications_paymentId_pending_key"
ON "bank_transfer_notifications" ("paymentId")
WHERE "status" = 'PENDING';
