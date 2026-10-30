-- ============================================================================
--  DESCUBRE EC  ·  BASES DE DATOS POR MICROSERVICIO (v2)
--  Basado en: Plan/microservicios_tablas_v2.html  (16 microservicios)
--  Origen de columnas y reglas: Plan/Script Base de dats.txt (v1.2, 3FN)
--  Motor: PostgreSQL 14+   |   Codificacion: UTF-8
-- ============================================================================
--
--  REGLAS DE ESTE SCRIPT
--  ---------------------------------------------------------------------------
--  1. Cada microservicio tiene SU PROPIA base de datos (database-per-service).
--  2. Solo se crean las FK que estan diagramadas DENTRO de cada microservicio.
--  3. Las referencias a tablas de OTRO servicio se guardan como ID logico:
--     la columna existe (con su indice) pero SIN FOREIGN KEY. Se valida por
--     API (REST/gRPC/SOAP) o por eventos.
--  4. "estado" ya no es un catalogo unico con est_grupo: Order, Booking,
--     Payment e Invoicing tienen cada uno su propia tabla estado.
--  5. Se conservan las convenciones del script original: tablas en singular,
--     PK = sigla + "_id", la FK se llama igual que la PK que referencia,
--     importes NUMERIC, toda FK con indice y ON DELETE explicito.
--
--  TABLAS DEL SCRIPT ORIGINAL QUE NO ESTAN EN EL DIAGRAMA (no se crean)
--  ---------------------------------------------------------------------------
--  - favorito          (se quito la wishlist)
--  - cliente_api, guia (v1.3; no figuran en el diagrama v2). Por eso
--    orden no lleva cla_id (usu_id es obligatorio) y reserva no lleva gui_id.
--
--  TRIGGERS / VISTAS QUE CAMBIAN AL SEPARAR LAS BASES
--  ---------------------------------------------------------------------------
--  - trg_resena_calificacion  -> evento RESENA_PUBLICADA (Review -> Catalog).
--  - trg_reembolso_no_excede  -> validacion en Refund consultando a Payment.
--  - v_atraccion_completa     -> queda en Catalog, sin JOIN a geografia.
--  - v_orden_financiero       -> queda en Order, expone usu_id (sin usuario).
--
--  EJECUCION (con psql, como superusuario)
--  ---------------------------------------------------------------------------
--     psql -U postgres -f 02_microservicios_v2_bases_de_datos.sql
--  El script crea las 16 bases y se conecta a cada una con \connect.
--
--  BASES CREADAS
--  ---------------------------------------------------------------------------
--   1 ms_identity        Identity & Access Service         (REST)
--   2 ms_billing_profile Billing Profile Service           (REST)
--   3 ms_location        Location Service                  (REST)
--   4 ms_catalog         Catalog & Attractions Service     (REST)
--   5 ms_review          Review Service                    (REST)
--   6 ms_pricing         Pricing Service                   (gRPC)
--   7 ms_inventory       Inventory & Availability Service  (gRPC)
--   8 ms_cart            Cart Service                      (REST)
--   9 ms_coupon          Coupon Service                    (REST)
--  10 ms_order           Order Management Service          (gRPC)
--  11 ms_booking         Booking Service                   (gRPC)
--  12 ms_payment         Payment Service                   (REST)
--  13 ms_refund          Refund Service                    (REST)
--  14 ms_invoicing       Electronic Invoicing Service      (SOAP)
--  15 ms_support         Support Service                   (REST)
--  16 ms_audit           Audit Service                     (REST, consumidor de eventos)
-- ============================================================================

\set ON_ERROR_STOP on

CREATE DATABASE ms_identity        ENCODING 'UTF8';
CREATE DATABASE ms_billing_profile ENCODING 'UTF8';
CREATE DATABASE ms_location        ENCODING 'UTF8';
CREATE DATABASE ms_catalog         ENCODING 'UTF8';
CREATE DATABASE ms_review          ENCODING 'UTF8';
CREATE DATABASE ms_pricing         ENCODING 'UTF8';
CREATE DATABASE ms_inventory       ENCODING 'UTF8';
CREATE DATABASE ms_cart            ENCODING 'UTF8';
CREATE DATABASE ms_coupon          ENCODING 'UTF8';
CREATE DATABASE ms_order           ENCODING 'UTF8';
CREATE DATABASE ms_booking         ENCODING 'UTF8';
CREATE DATABASE ms_payment         ENCODING 'UTF8';
CREATE DATABASE ms_refund          ENCODING 'UTF8';
CREATE DATABASE ms_invoicing       ENCODING 'UTF8';
CREATE DATABASE ms_support         ENCODING 'UTF8';
CREATE DATABASE ms_audit           ENCODING 'UTF8';


-- ============================================================================
--  1 · IDENTITY & ACCESS SERVICE  (REST)
--  Tablas: rol, usuario, usuario_rol, sesion, token_verificacion
--  Relaciones internas: rol 1-N usuario_rol, usuario 1-N usuario_rol,
--                       usuario 1-N sesion, usuario 1-N token_verificacion,
--                       usuario_rol.usr_asignado_por -> usuario
--  Referencias externas: ninguna
-- ============================================================================
\connect ms_identity

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE DOMAIN dom_correo AS VARCHAR(160)
    CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
CREATE DOMAIN dom_documento AS VARCHAR(20)
    CHECK (VALUE ~ '^[0-9]{10}$' OR VALUE ~ '^[A-Z]{1,2}[0-9]{6,9}$');
CREATE DOMAIN dom_telefono AS VARCHAR(20)
    CHECK (VALUE ~ '^\+?[0-9]{7,15}$');

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE rol (
    rol_id          SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rol_nombre      VARCHAR(30)  NOT NULL UNIQUE,   -- ADMIN, OPERADOR, CLIENTE
    rol_descripcion VARCHAR(200) NOT NULL,
    rol_activo      BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE usuario (
    usu_id         BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usu_correo     dom_correo    NOT NULL UNIQUE,
    usu_password   VARCHAR(100)  NOT NULL,          -- bcrypt, NUNCA texto plano
    usu_nombre     VARCHAR(120)  NOT NULL,
    usu_apellido   VARCHAR(120)  NOT NULL,
    usu_documento  dom_documento UNIQUE,
    usu_telefono   dom_telefono,
    usu_fecha_nacimiento DATE,
    usu_avatar     VARCHAR(255),
    usu_verificado BOOLEAN       NOT NULL DEFAULT FALSE,
    usu_activo     BOOLEAN       NOT NULL DEFAULT TRUE,
    usu_ultimo_acceso TIMESTAMPTZ,
    usu_creado_en  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    usu_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT usuario_nombres_no_vacios
        CHECK (btrim(usu_nombre) <> '' AND btrim(usu_apellido) <> '')
);

CREATE TABLE usuario_rol (
    usu_id           BIGINT      NOT NULL,
    rol_id           SMALLINT    NOT NULL,
    usr_asignado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    usr_asignado_por BIGINT,                        -- admin que lo asigno
    CONSTRAINT pk_usuario_rol PRIMARY KEY (usu_id, rol_id),
    CONSTRAINT fk_usuario_rol_usuario
        FOREIGN KEY (usu_id) REFERENCES usuario (usu_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_usuario_rol_rol
        FOREIGN KEY (rol_id) REFERENCES rol (rol_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_usuario_rol_asignador
        FOREIGN KEY (usr_asignado_por) REFERENCES usuario (usu_id)
        ON UPDATE CASCADE ON DELETE SET NULL
);
CREATE INDEX ix_usuario_rol_rol_id ON usuario_rol (rol_id);
CREATE INDEX ix_usuario_rol_asignado_por ON usuario_rol (usr_asignado_por);

CREATE TABLE sesion (
    ses_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    usu_id          BIGINT       NOT NULL,
    ses_token_hash  VARCHAR(128) NOT NULL UNIQUE,   -- SHA-256, nunca el token
    ses_ip          VARCHAR(45),
    ses_user_agent  VARCHAR(255),
    ses_expira_en   TIMESTAMPTZ  NOT NULL,
    ses_revocada    BOOLEAN      NOT NULL DEFAULT FALSE,
    ses_creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_sesion_usuario
        FOREIGN KEY (usu_id) REFERENCES usuario (usu_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_sesion_usu_id ON sesion (usu_id);
CREATE INDEX ix_sesion_expira_en ON sesion (ses_expira_en);

CREATE TABLE token_verificacion (
    tokv_id        BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usu_id         BIGINT       NOT NULL,
    tokv_token     VARCHAR(128) NOT NULL UNIQUE,
    tokv_tipo      VARCHAR(20)  NOT NULL,           -- EMAIL, RECUPERACION
    tokv_expira_en TIMESTAMPTZ  NOT NULL,
    tokv_usado     BOOLEAN      NOT NULL DEFAULT FALSE,
    tokv_creado_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT token_verificacion_tipo_valido
        CHECK (tokv_tipo IN ('EMAIL', 'RECUPERACION')),
    CONSTRAINT fk_token_verificacion_usuario
        FOREIGN KEY (usu_id) REFERENCES usuario (usu_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_token_verificacion_usu_id ON token_verificacion (usu_id);

CREATE TRIGGER trg_usuario_actualizado BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp('usu_actualizado_en');

CREATE VIEW v_usuario_roles AS
SELECT u.usu_id, u.usu_correo, u.usu_nombre, u.usu_apellido, r.rol_id, r.rol_nombre
FROM usuario u
JOIN usuario_rol ur ON ur.usu_id = u.usu_id
JOIN rol r          ON r.rol_id  = ur.rol_id
WHERE u.usu_activo AND r.rol_activo;

INSERT INTO rol (rol_nombre, rol_descripcion) VALUES
    ('ADMIN',    'Administrador total del marketplace'),
    ('OPERADOR', 'Empresa que opera atracciones'),
    ('CLIENTE',  'Usuario que compra y reserva');


-- ============================================================================
--  2 · BILLING PROFILE SERVICE  (REST)
--  Tablas: dato_facturacion
--  Referencias externas (ID logico): usu_id -> usuario (Identity)
-- ============================================================================
\connect ms_billing_profile

CREATE DOMAIN dom_correo AS VARCHAR(160)
    CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
CREATE DOMAIN dom_telefono AS VARCHAR(20)
    CHECK (VALUE ~ '^\+?[0-9]{7,15}$');

CREATE TABLE dato_facturacion (
    dfa_id                  BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usu_id                  BIGINT       NOT NULL,                   -- ID logico (Identity)
    dfa_tipo_identificacion VARCHAR(20)  NOT NULL DEFAULT 'CEDULA',  -- CEDULA, RUC, PASAPORTE, CONSUMIDOR_FINAL
    dfa_identificacion      VARCHAR(20)  NOT NULL,
    dfa_razon_social        VARCHAR(150) NOT NULL,
    dfa_correo              dom_correo   NOT NULL,
    dfa_telefono            dom_telefono,
    dfa_es_principal        BOOLEAN      NOT NULL DEFAULT FALSE,
    dfa_activo              BOOLEAN      NOT NULL DEFAULT TRUE,      -- borrado logico
    dfa_creado_en           TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT dato_facturacion_tipo_valido
        CHECK (dfa_tipo_identificacion IN ('CEDULA', 'RUC', 'PASAPORTE', 'CONSUMIDOR_FINAL')),
    CONSTRAINT dato_facturacion_identificacion_valida CHECK (
        (dfa_tipo_identificacion = 'CEDULA'           AND dfa_identificacion ~ '^[0-9]{10}$') OR
        (dfa_tipo_identificacion = 'RUC'              AND dfa_identificacion ~ '^[0-9]{13}$') OR
        (dfa_tipo_identificacion = 'PASAPORTE'        AND dfa_identificacion ~ '^[A-Z0-9]{6,20}$') OR
        (dfa_tipo_identificacion = 'CONSUMIDOR_FINAL' AND dfa_identificacion = '9999999999999')
    ),
    CONSTRAINT uq_dato_facturacion_usuario_identificacion
        UNIQUE (usu_id, dfa_tipo_identificacion, dfa_identificacion)
);
CREATE UNIQUE INDEX ux_dato_facturacion_principal
    ON dato_facturacion (usu_id) WHERE dfa_es_principal;
CREATE INDEX ix_dato_facturacion_usu_id ON dato_facturacion (usu_id);


-- ============================================================================
--  3 · LOCATION SERVICE  (REST)
--  Tablas: region, provincia, ciudad
--  Relaciones internas: region 1-N provincia, provincia 1-N ciudad
--  Referencias externas: ninguna
-- ============================================================================
\connect ms_location

CREATE TABLE region (
    reg_id      SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reg_nombre  VARCHAR(30)  NOT NULL UNIQUE,
    reg_codigo  CHAR(2)      NOT NULL UNIQUE,
    CONSTRAINT region_nombre_no_vacio CHECK (btrim(reg_nombre) <> '')
);

CREATE TABLE provincia (
    prov_id      SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    prov_nombre  VARCHAR(60)  NOT NULL UNIQUE,
    prov_codigo  CHAR(2)      NOT NULL UNIQUE,      -- codigo interno 01-24
    reg_id       SMALLINT     NOT NULL,
    prov_activa  BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT fk_provincia_region
        FOREIGN KEY (reg_id) REFERENCES region (reg_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_provincia_reg_id ON provincia (reg_id);

CREATE TABLE ciudad (
    ciu_id          SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ciu_nombre      VARCHAR(80)  NOT NULL,
    ciu_codigo      CHAR(6)      NOT NULL UNIQUE,   -- codigo INEC/DANE
    prov_id         SMALLINT     NOT NULL,
    ciu_activa      BOOLEAN      NOT NULL DEFAULT TRUE,
    ciu_descripcion VARCHAR(500),
    ciu_imagen      VARCHAR(500),
    CONSTRAINT uq_ciudad_provincia_nombre UNIQUE (prov_id, ciu_nombre),
    CONSTRAINT fk_ciudad_provincia
        FOREIGN KEY (prov_id) REFERENCES provincia (prov_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_ciudad_prov_id ON ciudad (prov_id);

CREATE TABLE atraccion_ubicacion (
    atr_id          BIGINT         PRIMARY KEY,
    ciu_id          SMALLINT       NOT NULL REFERENCES ciudad (ciu_id)
                                      ON UPDATE CASCADE ON DELETE RESTRICT,
    geo_latitud     NUMERIC(9,6)   NOT NULL,
    geo_longitud    NUMERIC(9,6)   NOT NULL,
    geo_direccion   VARCHAR(300),
    CONSTRAINT atraccion_ubicacion_latitud_valida
        CHECK (geo_latitud BETWEEN -90 AND 90),
    CONSTRAINT atraccion_ubicacion_longitud_valida
        CHECK (geo_longitud BETWEEN -180 AND 180)
);

INSERT INTO region (reg_nombre, reg_codigo) VALUES
    ('SIERRA',   'SI'),
    ('COSTA',    'CO'),
    ('AMAZONIA', 'AM'),
    ('GALAPAGOS','GA');

INSERT INTO provincia (prov_nombre, prov_codigo, reg_id) VALUES
    ('Azuay',                          '01', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Bolívar',                        '02', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Cañar',                          '03', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Carchi',                         '04', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Chimborazo',                     '05', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Cotopaxi',                       '06', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('El Oro',                         '07', (SELECT reg_id FROM region WHERE reg_codigo='CO')),
    ('Esmeraldas',                     '08', (SELECT reg_id FROM region WHERE reg_codigo='CO')),
    ('Galápagos',                      '09', (SELECT reg_id FROM region WHERE reg_codigo='GA')),
    ('Guayas',                         '10', (SELECT reg_id FROM region WHERE reg_codigo='CO')),
    ('Imbabura',                       '11', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Loja',                           '12', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Los Ríos',                       '13', (SELECT reg_id FROM region WHERE reg_codigo='CO')),
    ('Manabí',                         '14', (SELECT reg_id FROM region WHERE reg_codigo='CO')),
    ('Morona Santiago',                '15', (SELECT reg_id FROM region WHERE reg_codigo='AM')),
    ('Napo',                           '16', (SELECT reg_id FROM region WHERE reg_codigo='AM')),
    ('Orellana',                       '17', (SELECT reg_id FROM region WHERE reg_codigo='AM')),
    ('Pastaza',                        '18', (SELECT reg_id FROM region WHERE reg_codigo='AM')),
    ('Pichincha',                      '19', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Santa Elena',                    '20', (SELECT reg_id FROM region WHERE reg_codigo='CO')),
    ('Santo Domingo de los Tsáchilas', '21', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Sucumbíos',                      '22', (SELECT reg_id FROM region WHERE reg_codigo='AM')),
    ('Tungurahua',                     '23', (SELECT reg_id FROM region WHERE reg_codigo='SI')),
    ('Zamora Chinchipe',               '24', (SELECT reg_id FROM region WHERE reg_codigo='AM'));

INSERT INTO ciudad (ciu_nombre, ciu_codigo, prov_id) VALUES
    ('Cuenca',                 '010100', (SELECT prov_id FROM provincia WHERE prov_nombre='Azuay')),
    ('Guayaquil',              '090150', (SELECT prov_id FROM provincia WHERE prov_nombre='Guayas')),
    ('Quito',                  '170150', (SELECT prov_id FROM provincia WHERE prov_nombre='Pichincha')),
    ('Ambato',                 '180150', (SELECT prov_id FROM provincia WHERE prov_nombre='Tungurahua')),
    ('Riobamba',               '060100', (SELECT prov_id FROM provincia WHERE prov_nombre='Chimborazo')),
    ('Loja',                   '130100', (SELECT prov_id FROM provincia WHERE prov_nombre='Loja')),
    ('Puerto Baquerizo Moreno','020100', (SELECT prov_id FROM provincia WHERE prov_nombre='Galápagos')),
    ('Manta',                  '140350', (SELECT prov_id FROM provincia WHERE prov_nombre='Manabí')),
    ('Salinas',                '090300', (SELECT prov_id FROM provincia WHERE prov_nombre='Santa Elena')),
    ('La Troncal',             '030050', (SELECT prov_id FROM provincia WHERE prov_nombre='Cañar')),
    ('Ibarra',                 '100150', (SELECT prov_id FROM provincia WHERE prov_nombre='Imbabura')),
    ('Tulcan',                 '040100', (SELECT prov_id FROM provincia WHERE prov_nombre='Carchi')),
    ('Latacunga',              '050100', (SELECT prov_id FROM provincia WHERE prov_nombre='Cotopaxi')),
    ('Macas',                  '160100', (SELECT prov_id FROM provincia WHERE prov_nombre='Morona Santiago')),
    ('Puyo',                   '190150', (SELECT prov_id FROM provincia WHERE prov_nombre='Pastaza')),
    ('Archidona',              '170350', (SELECT prov_id FROM provincia WHERE prov_nombre='Napo')),
    ('Nueva Loja',             '230100', (SELECT prov_id FROM provincia WHERE prov_nombre='Sucumbíos'));


-- ============================================================================
--  4 · CATALOG & ATTRACTIONS SERVICE  (REST)
--  Tablas: categoria, operador, operador_usuario, idioma, inclusion,
--          atraccion, atraccion_categoria, atraccion_idioma,
--          atraccion_inclusion, atraccion_foto
--  Relaciones internas: categoria 1-N categoria (cat_padre_id),
--                       categoria 1-N atraccion_categoria,
--                       atraccion 1-N atraccion_categoria,
--                       atraccion 1-N atraccion_foto,
--                       operador  1-N atraccion,
--                       operador  1-N operador_usuario,
--                       atraccion 1-N atraccion_idioma, idioma 1-N atraccion_idioma,
--                       atraccion 1-N atraccion_inclusion, inclusion 1-N atraccion_inclusion
--  Referencias externas (ID logico): atraccion.ciu_id -> ciudad (Location),
--                       operador.prov_id -> provincia (Location),
--                       operador_usuario.usu_id -> usuario (Identity)
--  atr_calificacion_promedio / atr_numero_resenas se actualizan al consumir
--  el evento RESENA_PUBLICADA de Review.
-- ============================================================================
\connect ms_catalog

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE DOMAIN dom_correo AS VARCHAR(160)
    CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
CREATE DOMAIN dom_ruc AS VARCHAR(13)
    CHECK (VALUE ~ '^[0-9]{13}$');
CREATE DOMAIN dom_telefono AS VARCHAR(20)
    CHECK (VALUE ~ '^\+?[0-9]{7,15}$');
CREATE DOMAIN dom_moneda AS CHAR(3)
    CHECK (VALUE ~ '^[A-Z]{3}$');

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE operador (
    ope_id        BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ope_codigo    INTEGER      NOT NULL UNIQUE,     -- codigo legado del contrato
    ope_nombre    VARCHAR(150) NOT NULL,
    ope_ruc       dom_ruc      UNIQUE,
    ope_correo    dom_correo,
    ope_telefono  dom_telefono,
    ope_direccion VARCHAR(255),
    prov_id       SMALLINT     NOT NULL,            -- ID logico (Location)
    ope_activo    BOOLEAN      NOT NULL DEFAULT TRUE,
    ope_creado_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
    ope_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_operador_prov_id ON operador (prov_id);

CREATE TABLE operador_usuario (
    ope_id      BIGINT      NOT NULL,
    usu_id      BIGINT      NOT NULL,               -- ID logico (Identity)
    opeu_cargo  VARCHAR(60) NOT NULL,               -- ADMIN, VENDEDOR, GUIA
    opeu_activo BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT pk_operador_usuario PRIMARY KEY (ope_id, usu_id),
    CONSTRAINT fk_operador_usuario_operador
        FOREIGN KEY (ope_id) REFERENCES operador (ope_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_operador_usuario_usu_id ON operador_usuario (usu_id);

CREATE TABLE categoria (
    cat_id          INTEGER     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    cat_padre_id    INTEGER,                         -- autorreferencia
    cat_nombre      VARCHAR(80) NOT NULL,
    cat_slug        VARCHAR(80) NOT NULL UNIQUE,
    cat_descripcion VARCHAR(255),
    cat_icono       VARCHAR(40) NOT NULL DEFAULT 'map-pin',
    cat_orden       SMALLINT    NOT NULL DEFAULT 0,
    cat_activa      BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT categoria_no_es_ella_misma CHECK (cat_padre_id IS DISTINCT FROM cat_id),
    CONSTRAINT fk_categoria_padre
        FOREIGN KEY (cat_padre_id) REFERENCES categoria (cat_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_categoria_cat_padre_id ON categoria (cat_padre_id);

CREATE TABLE idioma (
    idi_id     SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    idi_codigo CHAR(2)     NOT NULL UNIQUE,          -- ISO 639-1
    idi_nombre VARCHAR(50) NOT NULL
);

CREATE TABLE inclusion (
    inc_id     INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    inc_tipo   VARCHAR(20)  NOT NULL,                -- INCLUYE, NO_INCLUYE, RECOMENDACION
    inc_nombre VARCHAR(150) NOT NULL,
    inc_orden  SMALLINT     NOT NULL DEFAULT 0,
    CONSTRAINT uq_inclusion_tipo_nombre UNIQUE (inc_tipo, inc_nombre),
    CONSTRAINT inclusion_tipo_valido
        CHECK (inc_tipo IN ('INCLUYE', 'NO_INCLUYE', 'RECOMENDACION'))
);
CREATE INDEX ix_inclusion_inc_tipo ON inclusion (inc_tipo);

CREATE TABLE atraccion (
    atr_id              BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atr_uuid            UUID          NOT NULL DEFAULT gen_random_uuid(),  -- id publico
    atr_nombre          VARCHAR(200)  NOT NULL,
    atr_slug            VARCHAR(220)  NOT NULL UNIQUE,
    atr_descripcion     TEXT          NOT NULL,
    atr_descripcion_corta VARCHAR(280),
    atr_tipo            VARCHAR(30)   NOT NULL,      -- GUIDED_TOUR, ADMISSION, DAY_TRIP, TRANSPORT, PACKAGE
    atr_estado          VARCHAR(20)   NOT NULL DEFAULT 'BORRADOR',  -- BORRADOR, PUBLICADA, INACTIVA
    atr_latitud         NUMERIC(10,6) NOT NULL,
    atr_longitud        NUMERIC(10,6) NOT NULL,
    atr_direccion       VARCHAR(255),
    atr_punto_encuentro VARCHAR(255),
    atr_duracion_horas  NUMERIC(5,2)  NOT NULL,
    atr_moneda          dom_moneda    NOT NULL DEFAULT 'USD',
    ciu_id              SMALLINT      NOT NULL,      -- ID logico (Location)
    ope_id              BIGINT        NOT NULL,
    atr_cancelacion_gratuita BOOLEAN  NOT NULL DEFAULT FALSE,
    atr_horas_cancelacion    SMALLINT NOT NULL DEFAULT 24,
    atr_destacada       BOOLEAN       NOT NULL DEFAULT FALSE,
    atr_calificacion_promedio NUMERIC(3,2) NOT NULL DEFAULT 0,  -- evento RESENA_PUBLICADA
    atr_numero_resenas  INTEGER       NOT NULL DEFAULT 0,       -- evento RESENA_PUBLICADA
    atr_creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atr_actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    atr_eliminado_en    TIMESTAMPTZ,                 -- borrado logico
    CONSTRAINT uq_atraccion_uuid UNIQUE (atr_uuid),
    CONSTRAINT atraccion_duracion_valida
        CHECK (atr_duracion_horas > 0 AND atr_duracion_horas <= 720),
    CONSTRAINT atraccion_calificacion_valida
        CHECK (atr_calificacion_promedio >= 0 AND atr_calificacion_promedio <= 5),
    CONSTRAINT atraccion_latitud_valida  CHECK (atr_latitud BETWEEN -90 AND 90),
    CONSTRAINT atraccion_longitud_valida CHECK (atr_longitud BETWEEN -180 AND 180),
    CONSTRAINT atraccion_horas_cancelacion_valida CHECK (atr_horas_cancelacion >= 0),
    CONSTRAINT atraccion_tipo_valido
        CHECK (atr_tipo IN ('GUIDED_TOUR', 'ADMISSION', 'DAY_TRIP', 'TRANSPORT', 'PACKAGE')),
    CONSTRAINT atraccion_estado_valido
        CHECK (atr_estado IN ('BORRADOR', 'PUBLICADA', 'INACTIVA')),
    CONSTRAINT fk_atraccion_operador
        FOREIGN KEY (ope_id) REFERENCES operador (ope_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_atraccion_ciu_id ON atraccion (ciu_id);
CREATE INDEX ix_atraccion_ope_id ON atraccion (ope_id);
CREATE INDEX ix_atraccion_estado ON atraccion (atr_estado);
CREATE INDEX ix_atraccion_busqueda
    ON atraccion USING gin ((atr_nombre || ' ' || atr_descripcion) gin_trgm_ops);

CREATE TABLE atraccion_categoria (
    atr_id BIGINT  NOT NULL,
    cat_id INTEGER NOT NULL,
    CONSTRAINT pk_atraccion_categoria PRIMARY KEY (atr_id, cat_id),
    CONSTRAINT fk_atraccion_categoria_atraccion
        FOREIGN KEY (atr_id) REFERENCES atraccion (atr_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_atraccion_categoria_categoria
        FOREIGN KEY (cat_id) REFERENCES categoria (cat_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_atraccion_categoria_cat_id ON atraccion_categoria (cat_id);

CREATE TABLE atraccion_idioma (
    atr_id BIGINT   NOT NULL,
    idi_id SMALLINT NOT NULL,
    CONSTRAINT pk_atraccion_idioma PRIMARY KEY (atr_id, idi_id),
    CONSTRAINT fk_atraccion_idioma_atraccion
        FOREIGN KEY (atr_id) REFERENCES atraccion (atr_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_atraccion_idioma_idioma
        FOREIGN KEY (idi_id) REFERENCES idioma (idi_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_atraccion_idioma_idi_id ON atraccion_idioma (idi_id);

CREATE TABLE atraccion_inclusion (
    atr_id BIGINT  NOT NULL,
    inc_id INTEGER NOT NULL,
    CONSTRAINT pk_atraccion_inclusion PRIMARY KEY (atr_id, inc_id),
    CONSTRAINT fk_atraccion_inclusion_atraccion
        FOREIGN KEY (atr_id) REFERENCES atraccion (atr_id)
        ON UPDATE CASCADE ON DELETE CASCADE,
    CONSTRAINT fk_atraccion_inclusion_inclusion
        FOREIGN KEY (inc_id) REFERENCES inclusion (inc_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_atraccion_inclusion_inc_id ON atraccion_inclusion (inc_id);

CREATE TABLE atraccion_foto (
    fot_id    BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atr_id    BIGINT       NOT NULL,
    fot_url   VARCHAR(500) NOT NULL,
    fot_alt   VARCHAR(200) NOT NULL,                 -- texto alternativo (WCAG 1.1.1)
    fot_orden SMALLINT     NOT NULL DEFAULT 0,
    CONSTRAINT fk_atraccion_foto_atraccion
        FOREIGN KEY (atr_id) REFERENCES atraccion (atr_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_atraccion_foto_atr_id ON atraccion_foto (atr_id);

CREATE TRIGGER trg_operador_actualizado BEFORE UPDATE ON operador
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp('ope_actualizado_en');
CREATE TRIGGER trg_atraccion_actualizado BEFORE UPDATE ON atraccion
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp('atr_actualizado_en');

-- Sin JOIN a geografia (vive en Location): se expone ciu_id para resolverlo por API.
CREATE VIEW v_atraccion_completa AS
SELECT a.atr_id, a.atr_nombre, a.atr_slug, a.atr_estado, a.atr_tipo,
       a.ciu_id, o.ope_nombre AS operador, o.ope_ruc AS operador_ruc
FROM atraccion a
JOIN operador o ON o.ope_id = a.ope_id;

INSERT INTO idioma (idi_codigo, idi_nombre) VALUES
    ('es','Espanol'), ('en','Ingles'), ('fr','Frances'), ('de','Aleman');

INSERT INTO categoria (cat_nombre, cat_slug, cat_descripcion, cat_orden) VALUES
    ('Aventura',   'aventura',   'Deportes extremos y naturaleza', 1),
    ('Cultural',   'cultural',   'Patrimonio e historia',          2),
    ('Naturales',  'naturales',  'Ecosistemas y fauna',            3),
    ('Gastronomia','gastronomia','Comida y bebida local',          4),
    ('Playas',     'playas',     'Costa y litoral',                5),
    ('Montana',    'montana',    'Sierra y senderismo',            6);


-- ============================================================================
--  5 · REVIEW SERVICE  (REST)
--  Tablas: resena
--  Referencias externas (ID logico): atr_id -> atraccion (Catalog),
--                                    usu_id -> usuario (Identity)
--  Publica el evento RESENA_PUBLICADA (reemplaza a trg_resena_calificacion).
-- ============================================================================
\connect ms_review

CREATE TABLE resena (
    ren_id           BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atr_id           BIGINT        NOT NULL,        -- ID logico (Catalog)
    usu_id           BIGINT,                        -- ID logico (Identity); NULL = anonima
    ren_autor_nombre VARCHAR(120),                  -- solo para resenas anonimas
    ren_puntuacion   SMALLINT      NOT NULL,
    ren_comentario   VARCHAR(1000) NOT NULL,
    ren_visible      BOOLEAN       NOT NULL DEFAULT TRUE,
    ren_creado_en    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT resena_puntuacion_valida CHECK (ren_puntuacion BETWEEN 1 AND 5),
    CONSTRAINT uq_resena_atraccion_usuario UNIQUE (atr_id, usu_id),
    CONSTRAINT resena_autor_coherente
        CHECK ((usu_id IS NOT NULL AND ren_autor_nombre IS NULL)
            OR (usu_id IS NULL AND ren_autor_nombre IS NOT NULL))
);
CREATE INDEX ix_resena_atr_id ON resena (atr_id);
CREATE INDEX ix_resena_usu_id ON resena (usu_id);


-- ============================================================================
--  6 · PRICING SERVICE  (gRPC)
--  Tablas: tarifa
--  Referencias externas (ID logico): atr_id -> atraccion (Catalog)
-- ============================================================================
\connect ms_pricing

CREATE DOMAIN dom_moneda AS CHAR(3)
    CHECK (VALUE ~ '^[A-Z]{3}$');
CREATE DOMAIN dom_importe AS NUMERIC(12,2)
    CHECK (VALUE >= 0);

CREATE TABLE tarifa (
    tar_id            BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atr_id            BIGINT      NOT NULL,         -- ID logico (Catalog)
    tar_tipo          VARCHAR(20) NOT NULL,         -- ADULTO, NINO, MAYOR, GRUPO
    tar_precio        dom_importe NOT NULL,
    tar_moneda        dom_moneda  NOT NULL DEFAULT 'USD',
    tar_vigente_desde DATE        NOT NULL DEFAULT CURRENT_DATE,
    tar_vigente_hasta DATE,                         -- NULL = vigente
    CONSTRAINT uq_tarifa_atraccion_tipo_desde UNIQUE (atr_id, tar_tipo, tar_vigente_desde),
    CONSTRAINT tarifa_tipo_valido
        CHECK (tar_tipo IN ('ADULTO', 'NINO', 'MAYOR', 'GRUPO')),
    CONSTRAINT tarifa_vigencia_valida
        CHECK (tar_vigente_hasta IS NULL OR tar_vigente_hasta >= tar_vigente_desde)
);
CREATE INDEX ix_tarifa_atr_id ON tarifa (atr_id);


-- ============================================================================
--  7 · INVENTORY & AVAILABILITY SERVICE  (gRPC)
--  Tablas: horario, disponibilidad, fecha_bloqueada
--  Relaciones internas: horario 1-N disponibilidad
--                       (FK compuesta (hor_id, atr_id) -> horario)
--  Referencias externas (ID logico): atr_id -> atraccion (Catalog) en las 3
-- ============================================================================
\connect ms_inventory

CREATE TABLE horario (
    hor_id     BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atr_id     BIGINT  NOT NULL,                    -- ID logico (Catalog)
    hor_hora   TIME    NOT NULL,
    hor_cupo   INTEGER NOT NULL DEFAULT 20,
    hor_activo BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT horario_cupo_positivo CHECK (hor_cupo > 0),
    CONSTRAINT uq_horario_atraccion_hora UNIQUE (atr_id, hor_hora),
    -- Clave candidata para la FK compuesta desde disponibilidad
    CONSTRAINT uq_horario_id_atraccion UNIQUE (hor_id, atr_id)
);
CREATE INDEX ix_horario_atr_id ON horario (atr_id);

CREATE TABLE disponibilidad (
    dis_id             BIGINT  GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atr_id             BIGINT  NOT NULL,            -- ID logico (Catalog)
    hor_id             BIGINT  NOT NULL,
    dis_fecha          DATE    NOT NULL,
    dis_cupo_total     INTEGER NOT NULL,
    dis_cupo_reservado INTEGER NOT NULL DEFAULT 0,
    dis_cerrada        BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_disponibilidad_atraccion_fecha_horario UNIQUE (atr_id, dis_fecha, hor_id),
    CONSTRAINT disponibilidad_cupos_validos
        CHECK (dis_cupo_total > 0
               AND dis_cupo_reservado >= 0
               AND dis_cupo_reservado <= dis_cupo_total),
    -- FK compuesta interna: el horario debe ser de la MISMA atraccion
    CONSTRAINT fk_disponibilidad_horario
        FOREIGN KEY (hor_id, atr_id) REFERENCES horario (hor_id, atr_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_disponibilidad_atr_id ON disponibilidad (atr_id);
CREATE INDEX ix_disponibilidad_hor_id ON disponibilidad (hor_id, atr_id);
CREATE INDEX ix_disponibilidad_fecha  ON disponibilidad (dis_fecha);

CREATE TABLE fecha_bloqueada (
    fb_id        BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    atr_id       BIGINT       NOT NULL,             -- ID logico (Catalog)
    fb_fecha     DATE         NOT NULL,
    fb_motivo    VARCHAR(200) NOT NULL,
    fb_creado_en TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_fecha_bloqueada_atraccion_fecha UNIQUE (atr_id, fb_fecha)
);
CREATE INDEX ix_fecha_bloqueada_atr_id ON fecha_bloqueada (atr_id);


-- ============================================================================
--  8 · CART SERVICE  (REST)
--  Tablas: carrito, carrito_item
--  Relaciones internas: carrito 1-N carrito_item
--  Referencias externas (ID logico): carrito.usu_id -> usuario (Identity),
--                       carrito_item.atr_id -> atraccion (Catalog),
--                       carrito_item.dis_id -> disponibilidad (Inventory)
-- ============================================================================
\connect ms_cart

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE carrito (
    car_id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usu_id             BIGINT      NOT NULL,        -- ID logico (Identity)
    car_activo         BOOLEAN     NOT NULL DEFAULT TRUE,
    car_creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    car_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_carrito_usu_id ON carrito (usu_id);
-- Solo UN carrito activo por usuario.
CREATE UNIQUE INDEX ux_carrito_activo ON carrito (usu_id) WHERE car_activo;

CREATE TABLE carrito_item (
    cai_id        BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    car_id        BIGINT      NOT NULL,
    atr_id        BIGINT      NOT NULL,             -- ID logico (Catalog)
    dis_id        BIGINT,                           -- ID logico (Inventory), opcional
    cai_adultos   INTEGER     NOT NULL DEFAULT 1,
    cai_ninos     INTEGER     NOT NULL DEFAULT 0,
    cai_creado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT carrito_item_cantidades_validas
        CHECK (cai_adultos > 0 AND cai_ninos >= 0),
    CONSTRAINT uq_carrito_item UNIQUE (car_id, atr_id, dis_id),
    CONSTRAINT fk_carrito_item_carrito
        FOREIGN KEY (car_id) REFERENCES carrito (car_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_carrito_item_car_id ON carrito_item (car_id);
CREATE INDEX ix_carrito_item_atr_id ON carrito_item (atr_id);
CREATE INDEX ix_carrito_item_dis_id ON carrito_item (dis_id);

CREATE TRIGGER trg_carrito_actualizado BEFORE UPDATE ON carrito
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp('car_actualizado_en');


-- ============================================================================
--  9 · COUPON SERVICE  (REST)
--  Tablas: cupon
--  Referencias externas: ninguna (los usos se cuentan en orden_cupon, Order)
-- ============================================================================
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


-- ============================================================================
--  10 · ORDER MANAGEMENT SERVICE  (gRPC)
--  Tablas: estado, orden, orden_detalle, orden_cupon, idempotencia
--  Relaciones internas: estado 1-N orden, orden 1-N orden_detalle,
--                       orden 1-N orden_cupon
--  Referencias externas (ID logico): orden.usu_id, idempotencia.idem_sujeto
--                       -> usuario (Identity); orden.car_id -> carrito (Cart);
--                       orden.mpa_id -> metodo_pago (Payment);
--                       orden_cupon.cup_id -> cupon (Coupon);
--                       orden_detalle.atr_id -> atraccion (Catalog)
-- ============================================================================
\connect ms_order

CREATE DOMAIN dom_moneda AS CHAR(3)
    CHECK (VALUE ~ '^[A-Z]{3}$');
CREATE DOMAIN dom_importe AS NUMERIC(12,2)
    CHECK (VALUE >= 0);

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Estados propios de la orden (sin est_grupo).
CREATE TABLE estado (
    est_id     SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    est_codigo VARCHAR(20) NOT NULL UNIQUE,
    est_nombre VARCHAR(50) NOT NULL,
    est_final  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE orden (
    ord_id             BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ord_numero         VARCHAR(20) NOT NULL UNIQUE,  -- external_order_id del contrato
    usu_id             BIGINT      NOT NULL,         -- ID logico (Identity)
    car_id             BIGINT,                       -- ID logico (Cart); NULL = compra directa
    est_id             SMALLINT    NOT NULL,
    mpa_id             SMALLINT,                     -- ID logico (Payment)
    ord_fecha          TIMESTAMPTZ NOT NULL DEFAULT now(),
    ord_subtotal       dom_importe NOT NULL DEFAULT 0,
    ord_descuento      dom_importe NOT NULL DEFAULT 0,
    ord_iva            dom_importe NOT NULL DEFAULT 0,
    ord_total          dom_importe NOT NULL DEFAULT 0,
    ord_moneda         dom_moneda  NOT NULL DEFAULT 'USD',
    ord_observaciones  VARCHAR(500),
    ord_creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    ord_actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT orden_total_coherente
        CHECK (ord_total = ord_subtotal - ord_descuento + ord_iva),
    -- Un carrito se convierte en UNA sola orden.
    CONSTRAINT uq_orden_car_id UNIQUE (car_id),
    CONSTRAINT fk_orden_estado
        FOREIGN KEY (est_id) REFERENCES estado (est_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_orden_usu_id ON orden (usu_id);
CREATE INDEX ix_orden_est_id ON orden (est_id);
CREATE INDEX ix_orden_fecha  ON orden (ord_fecha DESC);
CREATE INDEX ix_orden_mpa_id ON orden (mpa_id);

CREATE TABLE orden_detalle (
    det_id              BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ord_id              BIGINT       NOT NULL,
    atr_id              BIGINT       NOT NULL,       -- ID logico (Catalog)
    det_descripcion     VARCHAR(255) NOT NULL,       -- snapshot del nombre
    det_cantidad        INTEGER      NOT NULL,
    det_precio_unitario dom_importe  NOT NULL,       -- snapshot del precio (Pricing)
    det_subtotal        dom_importe  NOT NULL,
    CONSTRAINT orden_detalle_cantidad_valida CHECK (det_cantidad > 0),
    CONSTRAINT orden_detalle_subtotal_coherente
        CHECK (det_subtotal = det_cantidad * det_precio_unitario),
    CONSTRAINT fk_orden_detalle_orden
        FOREIGN KEY (ord_id) REFERENCES orden (ord_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_orden_detalle_ord_id ON orden_detalle (ord_id);
CREATE INDEX ix_orden_detalle_atr_id ON orden_detalle (atr_id);

CREATE TABLE orden_cupon (
    ord_id       BIGINT      NOT NULL,
    cup_id       BIGINT      NOT NULL,               -- ID logico (Coupon)
    orc_usado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT pk_orden_cupon PRIMARY KEY (ord_id, cup_id),
    CONSTRAINT fk_orden_cupon_orden
        FOREIGN KEY (ord_id) REFERENCES orden (ord_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_orden_cupon_cup_id ON orden_cupon (cup_id);

-- Registro de operaciones idempotentes (evita cobros dobles)
CREATE TABLE idempotencia (
    idem_clave        UUID         NOT NULL,
    idem_sujeto       BIGINT       NOT NULL,         -- ID logico usu_id (Identity)
    idem_operacion    VARCHAR(150) NOT NULL,
    idem_request_hash VARCHAR(64)  NOT NULL,
    idem_estado       VARCHAR(12)  NOT NULL DEFAULT 'IN_PROGRESS',
    idem_response     JSONB,
    idem_expira_en    TIMESTAMPTZ  NOT NULL,
    idem_creado_en    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_idempotencia PRIMARY KEY (idem_clave, idem_sujeto),
    CONSTRAINT idempotencia_estado_valido
        CHECK (idem_estado IN ('IN_PROGRESS', 'DONE', 'FAILED'))
);
CREATE INDEX ix_idempotencia_expira_en ON idempotencia (idem_expira_en);

CREATE TRIGGER trg_orden_actualizado BEFORE UPDATE ON orden
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp('ord_actualizado_en');

CREATE VIEW v_orden_financiero AS
SELECT o.ord_id, o.ord_numero, o.ord_fecha, o.usu_id,
       COALESCE(SUM(det.det_subtotal), 0) AS calculado_subtotal,
       o.ord_subtotal, o.ord_descuento, o.ord_iva, o.ord_total,
       (o.ord_subtotal - o.ord_descuento + o.ord_iva) AS total_recalculado
FROM orden o
LEFT JOIN orden_detalle det ON det.ord_id = o.ord_id
GROUP BY o.ord_id, o.ord_numero, o.ord_fecha, o.usu_id,
         o.ord_subtotal, o.ord_descuento, o.ord_iva, o.ord_total;

INSERT INTO estado (est_codigo, est_nombre, est_final) VALUES
    ('CREADA',      'Orden creada',      FALSE),
    ('PAGADA',      'Orden pagada',      TRUE),
    ('CANCELADA',   'Orden cancelada',   TRUE),
    ('REEMBOLSADA', 'Orden reembolsada', TRUE);


-- ============================================================================
--  11 · BOOKING SERVICE  (gRPC)
--  Tablas: estado, reserva, reserva_pasajero
--  Relaciones internas: estado 1-N reserva, reserva 1-N reserva_pasajero
--  Referencias externas (ID logico): reserva.det_id -> orden_detalle (Order),
--                                    reserva.dis_id -> disponibilidad (Inventory)
-- ============================================================================
\connect ms_booking

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE DOMAIN dom_documento AS VARCHAR(20)
    CHECK (VALUE ~ '^[0-9]{10}$' OR VALUE ~ '^[A-Z]{1,2}[0-9]{6,9}$');
CREATE DOMAIN dom_importe AS NUMERIC(12,2)
    CHECK (VALUE >= 0);

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW := jsonb_populate_record(NEW, jsonb_build_object(TG_ARGV[0], now()));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Estados propios de la reserva (sin est_grupo).
CREATE TABLE estado (
    est_id     SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    est_codigo VARCHAR(20) NOT NULL UNIQUE,
    est_nombre VARCHAR(50) NOT NULL,
    est_final  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE reserva (
    res_id                 BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    res_uuid               UUID         NOT NULL UNIQUE DEFAULT gen_random_uuid(), -- id publico
    res_codigo             VARCHAR(12)  NOT NULL UNIQUE,   -- DEC-7F3K9Q
    det_id                 BIGINT       NOT NULL,          -- ID logico (Order)
    dis_id                 BIGINT       NOT NULL,          -- ID logico (Inventory)
    est_id                 SMALLINT     NOT NULL,
    res_adultos            INTEGER      NOT NULL,
    res_ninos              INTEGER      NOT NULL DEFAULT 0,
    res_numero_tickets     INTEGER      NOT NULL,
    res_precio_unitario    dom_importe  NOT NULL,          -- snapshot
    res_subtotal           dom_importe  NOT NULL,
    res_observaciones      VARCHAR(500),
    res_motivo_cancelacion VARCHAR(255),
    res_creado_en          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    res_actualizado_en     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    res_cancelado_en       TIMESTAMPTZ,
    res_confirmado_en      TIMESTAMPTZ,
    CONSTRAINT reserva_pasajeros_validos
        CHECK (res_adultos > 0 AND res_ninos >= 0),
    CONSTRAINT reserva_total_coherente
        CHECK (res_numero_tickets = res_adultos + res_ninos),
    CONSTRAINT fk_reserva_estado
        FOREIGN KEY (est_id) REFERENCES estado (est_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_reserva_det_id ON reserva (det_id);
CREATE INDEX ix_reserva_dis_id ON reserva (dis_id);
CREATE INDEX ix_reserva_est_id ON reserva (est_id);

CREATE TABLE reserva_pasajero (
    pax_id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    res_id               BIGINT       NOT NULL,
    pax_nombre           VARCHAR(120) NOT NULL,
    pax_documento        dom_documento,
    pax_fecha_nacimiento DATE,
    pax_es_titular       BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_reserva_pasajero_reserva
        FOREIGN KEY (res_id) REFERENCES reserva (res_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_reserva_pasajero_res_id ON reserva_pasajero (res_id);

CREATE TRIGGER trg_reserva_actualizado BEFORE UPDATE ON reserva
    FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp('res_actualizado_en');

INSERT INTO estado (est_codigo, est_nombre, est_final) VALUES
    ('PENDIENTE_PAGO', 'Reserva pendiente',  FALSE),
    ('CONFIRMADA',     'Reserva confirmada', FALSE),
    ('CANCELADA',      'Reserva cancelada',  TRUE),
    ('COMPLETADA',     'Reserva completada', TRUE);


-- ============================================================================
--  12 · PAYMENT SERVICE  (REST)
--  Tablas: metodo_pago, estado, pago, pago_tarjeta, pago_transferencia
--  Relaciones internas: metodo_pago 1-N pago, estado 1-N pago,
--                       pago 1-1 pago_tarjeta, pago 1-1 pago_transferencia
--  Referencias externas (ID logico): pago.ord_id -> orden (Order)
--  La moneda del pago es la de la orden: se consulta a Order.
-- ============================================================================
\connect ms_payment

CREATE DOMAIN dom_importe AS NUMERIC(12,2)
    CHECK (VALUE >= 0);

CREATE TABLE metodo_pago (
    mpa_id             SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    mpa_codigo         VARCHAR(20) NOT NULL UNIQUE,  -- TARJETA, TRANSFERENCIA, EN_SITIO
    mpa_nombre         VARCHAR(60) NOT NULL,
    mpa_requiere_datos BOOLEAN     NOT NULL DEFAULT FALSE,
    mpa_activo         BOOLEAN     NOT NULL DEFAULT TRUE
);

-- Estados propios del pago (sin est_grupo).
CREATE TABLE estado (
    est_id     SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    est_codigo VARCHAR(20) NOT NULL UNIQUE,
    est_nombre VARCHAR(50) NOT NULL,
    est_final  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE pago (
    pag_id             BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pag_numero         VARCHAR(30)  NOT NULL UNIQUE,
    ord_id             BIGINT       NOT NULL,        -- ID logico (Order)
    mpa_id             SMALLINT     NOT NULL,
    est_id             SMALLINT     NOT NULL,
    pag_monto          dom_importe  NOT NULL,        -- moneda: la de la orden
    pag_referencia     VARCHAR(100),                 -- id de la pasarela
    pag_autorizacion   VARCHAR(100),
    pag_fecha          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    pag_aprobado_en    TIMESTAMPTZ,
    pag_rechazado_en   TIMESTAMPTZ,
    pag_motivo_rechazo VARCHAR(300),
    pag_creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pago_monto_valido CHECK (pag_monto > 0),
    CONSTRAINT pago_aprobado_o_rechazado
        CHECK (pag_aprobado_en IS NULL OR pag_rechazado_en IS NULL),
    CONSTRAINT pago_motivo_solo_si_rechazado
        CHECK (pag_motivo_rechazo IS NULL OR pag_rechazado_en IS NOT NULL),
    CONSTRAINT fk_pago_metodo_pago
        FOREIGN KEY (mpa_id) REFERENCES metodo_pago (mpa_id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
    CONSTRAINT fk_pago_estado
        FOREIGN KEY (est_id) REFERENCES estado (est_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_pago_ord_id ON pago (ord_id);
CREATE INDEX ix_pago_mpa_id ON pago (mpa_id);
CREATE INDEX ix_pago_est_id ON pago (est_id);
CREATE INDEX ix_pago_fecha  ON pago (pag_fecha DESC);
-- Una orden tiene a lo sumo UN pago aprobado.
CREATE UNIQUE INDEX ux_pago_orden_aprobado
    ON pago (ord_id) WHERE pag_aprobado_en IS NOT NULL;

-- NUNCA se guarda el numero de tarjeta (PCI-DSS).
CREATE TABLE pago_tarjeta (
    pat_id       BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pag_id       BIGINT       NOT NULL,
    pat_marca    VARCHAR(20)  NOT NULL,              -- VISA, MASTERCARD, AMEX
    pat_ultimos4 CHAR(4)      NOT NULL,
    pat_titular  VARCHAR(120) NOT NULL,
    pat_mes      SMALLINT     NOT NULL,
    pat_anio     SMALLINT     NOT NULL,
    pat_pais     CHAR(2)      NOT NULL,
    CONSTRAINT pago_tarjeta_mes_valido  CHECK (pat_mes BETWEEN 1 AND 12),
    CONSTRAINT pago_tarjeta_anio_valido CHECK (pat_anio BETWEEN 2020 AND 2100),
    CONSTRAINT pago_tarjeta_ultimos4_formato CHECK (pat_ultimos4 ~ '^[0-9]{4}$'),
    CONSTRAINT uq_pago_tarjeta_pag_id UNIQUE (pag_id),          -- 1:1
    CONSTRAINT fk_pago_tarjeta_pago
        FOREIGN KEY (pag_id) REFERENCES pago (pag_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

CREATE TABLE pago_transferencia (
    ptr_id                  BIGINT      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pag_id                  BIGINT      NOT NULL,
    ptr_banco               VARCHAR(60) NOT NULL,
    ptr_numero_comprobante  VARCHAR(40) NOT NULL,
    ptr_fecha_transferencia DATE        NOT NULL,
    ptr_archivo_adjunto     VARCHAR(500),
    CONSTRAINT uq_pago_transferencia_pag_id UNIQUE (pag_id),    -- 1:1
    CONSTRAINT fk_pago_transferencia_pago
        FOREIGN KEY (pag_id) REFERENCES pago (pag_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);

INSERT INTO metodo_pago (mpa_codigo, mpa_nombre, mpa_requiere_datos) VALUES
    ('TARJETA',       'Tarjeta de credito/debito', TRUE),
    ('TRANSFERENCIA', 'Transferencia bancaria',    FALSE),
    ('EN_SITIO',      'Pago en el punto de venta', FALSE),
    ('PAYPHAL',       'PayPal',                    FALSE);

INSERT INTO estado (est_codigo, est_nombre, est_final) VALUES
    ('PENDIENTE', 'Pago pendiente', FALSE),
    ('APROBADO',  'Pago aprobado',  TRUE),
    ('RECHAZADO', 'Pago rechazado', TRUE),
    ('FALLIDO',   'Pago fallido',   TRUE);


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


-- ============================================================================
--  14 · ELECTRONIC INVOICING SERVICE  (SOAP)
--  Tablas: estado, factura, factura_detalle
--  Relaciones internas: estado 1-N factura, factura 1-N factura_detalle
--  Referencias externas (ID logico): factura.ord_id -> orden (Order),
--                       factura.dfa_id -> dato_facturacion (Billing Profile),
--                       factura_detalle.det_id -> orden_detalle (Order)
-- ============================================================================
\connect ms_invoicing

CREATE DOMAIN dom_correo AS VARCHAR(160)
    CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
CREATE DOMAIN dom_telefono AS VARCHAR(20)
    CHECK (VALUE ~ '^\+?[0-9]{7,15}$');
CREATE DOMAIN dom_porcentaje AS NUMERIC(5,2)
    CHECK (VALUE >= 0 AND VALUE <= 100);
CREATE DOMAIN dom_importe AS NUMERIC(12,2)
    CHECK (VALUE >= 0);

-- Estados propios de la factura (sin est_grupo).
CREATE TABLE estado (
    est_id     SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    est_codigo VARCHAR(20) NOT NULL UNIQUE,
    est_nombre VARCHAR(50) NOT NULL,
    est_final  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE factura (
    fac_id               BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ord_id               BIGINT       NOT NULL,      -- ID logico (Order)
    dfa_id               BIGINT,                     -- ID logico (Billing Profile)
    fac_numero           VARCHAR(20)  NOT NULL UNIQUE,
    fac_clave_acceso     VARCHAR(49),                -- clave de acceso SRI
    fac_autorizacion_sri VARCHAR(49),
    est_id               SMALLINT     NOT NULL,
    fac_emitida_en       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    fac_subtotal         dom_importe  NOT NULL,
    fac_descuento        dom_importe  NOT NULL DEFAULT 0,
    fac_iva              dom_importe  NOT NULL DEFAULT 0,
    fac_total            dom_importe  NOT NULL,
    -- Snapshot del comprador al momento de emitir
    fac_tipo_identificacion VARCHAR(20)  NOT NULL,
    fac_identificacion      VARCHAR(20)  NOT NULL,
    fac_razon_social        VARCHAR(150) NOT NULL,
    fac_correo              dom_correo   NOT NULL,
    fac_telefono            dom_telefono,
    CONSTRAINT factura_tipo_identificacion_valido
        CHECK (fac_tipo_identificacion IN ('CEDULA', 'RUC', 'PASAPORTE', 'CONSUMIDOR_FINAL')),
    CONSTRAINT factura_total_coherente
        CHECK (fac_total = fac_subtotal - fac_descuento + fac_iva),
    CONSTRAINT uq_factura_orden UNIQUE (ord_id),
    CONSTRAINT fk_factura_estado
        FOREIGN KEY (est_id) REFERENCES estado (est_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
);
CREATE INDEX ix_factura_dfa_id ON factura (dfa_id);
CREATE INDEX ix_factura_est_id ON factura (est_id);

CREATE TABLE factura_detalle (
    fde_id              BIGINT         GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fac_id              BIGINT         NOT NULL,
    det_id              BIGINT         NOT NULL,     -- ID logico (Order)
    fde_codigo          VARCHAR(25)    NOT NULL,     -- codigo principal del producto (SRI)
    fde_descripcion     VARCHAR(300)   NOT NULL,
    fde_cantidad        INTEGER        NOT NULL,
    fde_precio_unitario dom_importe    NOT NULL,
    fde_descuento       dom_importe    NOT NULL DEFAULT 0,
    fde_subtotal        dom_importe    NOT NULL,
    fde_iva_porcentaje  dom_porcentaje NOT NULL DEFAULT 0,
    fde_iva             dom_importe    NOT NULL DEFAULT 0,
    fde_total           dom_importe    NOT NULL,
    CONSTRAINT factura_detalle_cantidad_valida CHECK (fde_cantidad > 0),
    CONSTRAINT factura_detalle_subtotal_coherente
        CHECK (fde_subtotal = fde_cantidad * fde_precio_unitario - fde_descuento),
    CONSTRAINT factura_detalle_total_coherente
        CHECK (fde_total = fde_subtotal + fde_iva),
    -- Una linea de orden se factura una sola vez
    CONSTRAINT uq_factura_detalle_det_id UNIQUE (det_id),
    CONSTRAINT fk_factura_detalle_factura
        FOREIGN KEY (fac_id) REFERENCES factura (fac_id)
        ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX ix_factura_detalle_fac_id ON factura_detalle (fac_id);

INSERT INTO estado (est_codigo, est_nombre, est_final) VALUES
    ('NO_PAGADA', 'Factura no pagada', FALSE),
    ('PAGADA',    'Factura pagada',    TRUE),
    ('ANULADA',   'Factura anulada',   TRUE);


-- ============================================================================
--  15 · SUPPORT SERVICE  (REST)
--  Tablas: mensaje_contacto
--  Referencias externas: ninguna
-- ============================================================================
\connect ms_support

CREATE DOMAIN dom_correo AS VARCHAR(160)
    CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

CREATE TABLE mensaje_contacto (
    men_id        BIGINT        GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    men_nombre    VARCHAR(120)  NOT NULL,
    men_correo    dom_correo    NOT NULL,
    men_asunto    VARCHAR(30)   NOT NULL,
    men_cuerpo    VARCHAR(2000) NOT NULL,
    men_leido     BOOLEAN       NOT NULL DEFAULT FALSE,
    men_creado_en TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX ix_mensaje_contacto_leido ON mensaje_contacto (men_leido);


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
