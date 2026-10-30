\connect ms_coupon

CREATE DOMAIN dom_importe AS NUMERIC(12,2)
    CHECK (VALUE >= 0);

CREATE TABLE cupon (
    cup_id           BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cup_codigo       VARCHAR(30) NOT NULL UNIQUE,
    cup_tipo         VARCHAR(20) NOT NULL,          -- PORCENTAJE, FIJO
    cup_valor        dom_importe NOT NULL,
    cup_fecha_inicio DATE        NOT NULL,
    cup_fecha_fin    DATE,
    cup_usos_max     INTEGER,                       -- NULL = sin limite
    cup_activo       BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT cupon_tipo_valido CHECK (cup_tipo IN ('PORCENTAJE', 'FIJO')),
    CONSTRAINT cupon_vigencia_valida
        CHECK (cup_fecha_fin IS NULL OR cup_fecha_fin >= cup_fecha_inicio),
    CONSTRAINT cupon_usos_valido
        CHECK (cup_usos_max IS NULL OR cup_usos_max > 0),
    CONSTRAINT cupon_porcentaje_valido
        CHECK (cup_tipo <> 'PORCENTAJE' OR cup_valor <= 100)
);
CREATE INDEX ix_cupon_activo ON cupon (cup_activo);
