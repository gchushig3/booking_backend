CREATE TABLE IF NOT EXISTS audit_event (
    event_id        VARCHAR(128) PRIMARY KEY,
    correlation_id  VARCHAR(128) NOT NULL,
    service         VARCHAR(80)  NOT NULL,
    event_type      VARCHAR(80)  NOT NULL,
    payload         JSONB        NOT NULL,
    event_timestamp TIMESTAMPTZ  NOT NULL,
    source_queue    VARCHAR(160) NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_audit_event_correlation
    ON audit_event (correlation_id, event_timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_audit_event_type_timestamp
    ON audit_event (event_type, event_timestamp DESC);
