BEGIN;
ALTER TABLE reembolso
    ADD COLUMN IF NOT EXISTS rem_event_id UUID,
    ADD COLUMN IF NOT EXISTS rem_correlation_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS rem_estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE';

UPDATE reembolso
   SET rem_event_id = gen_random_uuid()
 WHERE rem_event_id IS NULL;
UPDATE reembolso
   SET rem_correlation_id = 'legacy-' || rem_id
 WHERE rem_correlation_id IS NULL;

ALTER TABLE reembolso
    ALTER COLUMN rem_event_id SET NOT NULL,
    ALTER COLUMN rem_correlation_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_reembolso_event_id
    ON reembolso (rem_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reembolso_correlation_id
    ON reembolso (rem_correlation_id);
CREATE INDEX IF NOT EXISTS ix_reembolso_pag_id ON reembolso (pag_id);
COMMIT;
