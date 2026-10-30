# MS Coupon Service

Microservicio de cupones de descuento del Sistema de Atracciones (Descubre EC).

- **Responsabilidad:** Gestionar los cupones de descuento: tabla `cupon`.
- **Contrato:** REST en `/api/v2`; esquemas AJV y JWT RS256 mediante Identity.
- **Base de datos:** `ms_coupon` (database-per-service).
- **Dependencias externas:** Ninguna (no consume otros microservicios).

## Descripción

El microservicio de cupones expone el CRUD de cupones de descuento (`cupon`) que
utilizaran los servicios de carrito, orden, pricing y booking para aplicar
promociones.

El cupon soporta los tipos de descuento:

- `PORCENTAJE`: valor entre `0` y `100` (ej. `10` = 10%).
- `FIJO`: valor monetario fijo a descontar (ej. `15000` = $15.000).

Ademas, el cupon registra su vigencia (`cup_fecha_inicio` / `cup_fecha_fin`) y
el uso maximo (`cup_usos_max`, `NULL` = sin limite).

## Endpoints

| Metodo | Ruta | Descripcion | Respuesta |
|---|---|---|---|
| GET | `/api/v2/cupones` | Listar cupones | 200 |
| GET | `/api/v2/cupones/codigo/:cupCodigo` | Consultar por codigo | 200 / 404 |
| GET | `/api/v2/cupones/validar/:cupCodigo` | Validar activo y vigencia (`?fecha=YYYY-MM-DD`) | 200 / 404 |
| GET | `/api/v2/cupones/:id` | Consultar por id | 200 / 404 |
| POST | `/api/v2/cupones` | Crear (ADMIN) | 201 |
| PUT/PATCH/DELETE | `/api/v2/cupones/:id` | Gestionar (ADMIN) | 200/204 |

### Detalle de endpoints

#### GET `/api/v2/cupones`

Lista todos los cupones ordenados por `cup_id`.

**Respuesta:** `200 OK` — array de cupones.

#### GET `/api/v2/cupones/codigo/:cupCodigo`

Busca un cupon por su codigo unico (`cup_codigo`).

**Respuesta:** `200 OK` — cupon encontrado; `404 Not Found` si no existe.

#### GET `/api/v2/cupones/:id`

Obtiene un cupon por su identificador (`cup_id`).

**Respuesta:** `200 OK` — cupon encontrado; `404 Not Found` si no existe.

#### POST `/api/v2/cupones`

Crea un cupon.

**Body (CreateCuponDto):**

| Campo | Tipo | Obligatorio | Validacion |
|---|---|---|---|
| `cup_codigo` | string (max 30) | Si | No vacio, unico en BD |
| `cup_tipo` | string | Si | `PORCENTAJE` \| `FIJO` |
| `cup_valor` | number | Si | `>= 0`; si es `PORCENTAJE`, `<= 100` |
| `cup_fecha_inicio` | date (ISO) | Si | Fecha de inicio |
| `cup_fecha_fin` | date (ISO) | No | Fecha fin (opcional) |
| `cup_usos_max` | integer | No | `>= 0`; `NULL` = sin limite |
| `cup_activo` | boolean | No | Por defecto `true` |

**Respuesta:** `201 Created` + header `Location: /api/v1/cupones/{cup_id}`;
`400 Bad Request` si el body no es valido.

#### PUT `/api/v2/cupones/:id`

Reemplaza un cupon existente (mismos campos que `POST`).

**Respuesta:** `204 No Content`; `400` / `404`.

#### PATCH `/api/v2/cupones/:id`

Actualizacion parcial de un cupon (todos los campos del DTO son opcionales).

**Respuesta:** `200 OK` con el cupon actualizado; `404 Not Found`.

#### DELETE `/api/v2/cupones/:id`

Elimina un cupon.

**Respuesta:** `204 No Content`; `404 Not Found`.

## Modelo de datos

Tabla `cupon` (domain `dom_importe NUMERIC(12,2) CHECK (VALUE >= 0)`):

| Campo | Tipo | Descripcion |
|---|---|---|
| `cup_id` | BIGINT (identity) | Identificador del cupon |
| `cup_codigo` | VARCHAR(30) | Codigo unico del cupon |
| `cup_tipo` | VARCHAR(20) | `PORCENTAJE` \| `FIJO` |
| `cup_valor` | NUMERIC(12,2) | Valor del descuento |
| `cup_fecha_inicio` | DATE | Fecha de inicio |
| `cup_fecha_fin` | DATE | Fecha fin (NULL = sin vigencia) |
| `cup_usos_max` | INTEGER | Usos maximos (NULL = sin limite) |
| `cup_activo` | BOOLEAN | Activo por defecto |

Indices/constraints definidos en `init-coupon.sql`:
`cupon.cup_codigo` UNIQUE, `ix_cupon_activo` en `cup_activo`, y constraints de
validacion de tipo, vigencia y porcentaje.

## Variables de entorno

| Variable | Descripcion | Ejemplo |
|---|---|---|
| `DATABASE_URL` | URL de PostgreSQL del microservicio | `postgresql://postgres:postgres@localhost:5432/ms_coupon` |
| `NODE_ENV` | Entorno | `development` |
| `PORT` | Puerto HTTP | `3000` |

## Ejecucion local

```bash
# 1. Levantar PostgreSQL (Docker)
docker compose up -d

# 2. Aplicar esquema y datos iniciales
psql -U postgres -d ms_coupon -f init-coupon.sql

# 3. Levantar el microservicio
npm run start:dev
```

El puerto local por defecto es `3018`; lee `.env.example` para la configuracion.

## Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Despliegue

Fuera de alcance en esta fase (solo se requiere el microservicio listo y funcional).
