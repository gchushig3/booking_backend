# MS Billing Profile Service

Microservicio de facturacion del Sistema de Atracciones (Descubre EC).

- **Responsabilidad:** Gestionar los datos de facturacion: tabla `dato_facturacion`.
- **Contrato:** REST (`/api/v1/...`), prefijo global `api/v1`, Swagger UI en `/api/docs`.
- **Base de datos:** `ms_billing_profile` (database-per-service).
- **Dependencias externas:** Ninguna (no consume otros microservicios).

## Endpoints

| Metodo | Ruta | Descripcion | Respuesta |
|---|---|---|---|
| GET | `/api/v1/datos-facturacion` | Listar todos los datos de facturacion | 200 |
| GET | `/api/v1/datos-facturacion/usuario/:usuId` | Listar datos de facturacion por usuario | 200 / 404 / 400 |
| GET | `/api/v1/datos-facturacion/:id` | Obtener un dato por su identificador | 200 / 404 / 400 |
| POST | `/api/v1/datos-facturacion` | Crear un dato de facturacion | 201 + `Location` |
| PUT | `/api/v1/datos-facturacion/:id` | Reemplazar un dato | 204 |
| PATCH | `/api/v1/datos-facturacion/:id` | Actualizar parcialmente un dato | 200 / 404 |
| DELETE | `/api/v1/datos-facturacion/:id` | Eliminar un dato | 204 |

## Base de datos

El esquema y los datos iniciales se encuentran en `init-billing_profile.sql`
(tables: `dato_facturacion` y domains `dom_correo` / `dom_telefono`).

## Ejecucion local

```bash
# 1. Levantar PostgreSQL (Docker)
docker compose up -d

# 2. Aplicar esquema y datos iniciales
psql -U postgres -d ms_billing_profile -f init-billing_profile.sql

# 3. Levantar el microservicio
npm run start:dev
```

Swagger UI: <http://localhost:3000/api/docs>

## Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Despliegue

Fuera de alcance en esta fase (solo se requiere el microservicio listo y funcional).
