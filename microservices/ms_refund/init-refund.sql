-- ============================================================================
--  13 · REFUND SERVICE  (REST)
--  Tablas: reembolso
--  Referencias externas (ID logico): pag_id -> pago (Payment)
--  Regla "no reembolsar mas de lo cobrado" (antes trg_reembolso_no_excede):
--  el servicio consulta a Payment el pag_monto antes de procesar.
-- ============================================================================
\connect ms_refund

CREATE DOMAIN dom_importe AS NUMERIC(12,2)
    CHECK (VALUE >= 0);

CREATE TABLE reembolso (
    rem_id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pag_id            BIGINT      NOT NULL,         -- ID logico (Payment)
    rem_numero        VARCHAR(30) NOT NULL UNIQUE,
    rem_event_id      UUID        NOT NULL DEFAULT gen_random_uuid(),
    rem_monto         dom_importe NOT NULL,
    rem_motivo        VARCHAR(300),
    rem_referencia    VARCHAR(100),                 -- id del reembolso en la pasarela
    rem_correlation_id VARCHAR(128) NOT NULL,
    rem_estado        VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    rem_solicitado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    rem_procesado_en  TIMESTAMPTZ,
    rem_creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT reembolso_monto_valido CHECK (rem_monto > 0),
    CONSTRAINT reembolso_estado_valido CHECK (rem_estado IN ('PENDIENTE', 'PROCESADO'))
);
CREATE INDEX ix_reembolso_pag_id ON reembolso (pag_id);
CREATE UNIQUE INDEX uq_reembolso_event_id ON reembolso (rem_event_id);
CREATE UNIQUE INDEX uq_reembolso_correlation_id ON reembolso (rem_correlation_id);
