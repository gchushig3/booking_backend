-- Ejecutar en CADA base participante. No hay consultas entre bases.
CREATE TABLE IF NOT EXISTS saga_inbox (
  event_id UUID PRIMARY KEY, payload_hash CHAR(64) NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saga_outbox (
  event_id UUID PRIMARY KEY, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ, attempts INTEGER NOT NULL DEFAULT 0, next_attempt TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_saga_outbox_pending ON saga_outbox(next_attempt,created_at) WHERE published_at IS NULL;
CREATE TABLE IF NOT EXISTS saga_http_request (
  request_key TEXT PRIMARY KEY, payload_hash CHAR(64) NOT NULL, response JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
