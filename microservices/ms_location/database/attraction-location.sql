CREATE TABLE IF NOT EXISTS atraccion_ubicacion (
    atr_id          BIGINT         PRIMARY KEY,
    ciu_id          SMALLINT       NOT NULL REFERENCES ciudad (ciu_id)
                                      ON UPDATE CASCADE ON DELETE RESTRICT,
    geo_latitud     NUMERIC(9,6)   NOT NULL
                                      CHECK (geo_latitud BETWEEN -90 AND 90),
    geo_longitud    NUMERIC(9,6)   NOT NULL
                                      CHECK (geo_longitud BETWEEN -180 AND 180),
    geo_direccion   VARCHAR(300)
);
