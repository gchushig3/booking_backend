-- Aplicar manualmente sobre ms_catalog despues del SQL oficial. Sin DDL automatico.
BEGIN;
CREATE TABLE IF NOT EXISTS booking_attraction_profile (
  atr_id BIGINT PRIMARY KEY REFERENCES atraccion(atr_id) ON DELETE CASCADE,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_booking_profile_city ON booking_attraction_profile ((lower(payload->>'city')));
-- Version por atraccion del ultimo RESENA_PUBLICADA aplicado (idempotencia y orden).
CREATE TABLE IF NOT EXISTS resena_proyeccion (
  atr_id BIGINT PRIMARY KEY REFERENCES atraccion(atr_id) ON DELETE CASCADE,
  version BIGINT NOT NULL CHECK (version > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMIT;
