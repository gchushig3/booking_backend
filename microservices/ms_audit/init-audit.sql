-- ============================================================================
--  16 · AUDIT SERVICE  (REST · consumidor de eventos)
--  Tablas: bitacora
--  Referencias externas (ID logico): usu_id -> usuario (Identity)
-- ============================================================================
\connect ms_audit

CREATE TABLE bitacora (
    bit_id         BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usu_id         BIGINT,                          -- ID logico (Identity); NULL si es anonimo
    bit_accion     VARCHAR(60) NOT NULL,
    bit_entidad    VARCHAR(60) NOT NULL,
    bit_entidad_id VARCHAR(64),
    bit_detalle    JSONB,
    bit_ip         VARCHAR(45),
    bit_creado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_bitacora_usu_id  ON bitacora (usu_id);
CREATE INDEX ix_bitacora_fecha   ON bitacora (bit_creado_en DESC);
CREATE INDEX ix_bitacora_entidad ON bitacora (bit_entidad, bit_entidad_id);

CREATE TABLE audit_event (
    event_id        VARCHAR(128) PRIMARY KEY,
    correlation_id  VARCHAR(128) NOT NULL,
    service         VARCHAR(80)  NOT NULL,
    event_type      VARCHAR(80)  NOT NULL,
    payload         JSONB        NOT NULL,
    event_timestamp TIMESTAMPTZ  NOT NULL,
    source_queue    VARCHAR(160) NOT NULL
);
CREATE INDEX ix_audit_event_correlation
    ON audit_event (correlation_id, event_timestamp DESC);
CREATE INDEX ix_audit_event_type_timestamp
    ON audit_event (event_type, event_timestamp DESC);