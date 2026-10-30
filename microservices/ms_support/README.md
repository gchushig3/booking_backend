# MS Support Service

Microservicio de soporte del Sistema de Atracciones (Descubre EC).

- **Responsabilidad:** Gestionar los mensajes de contacto / soporte: tabla `mensaje_contacto`.
- **Contrato:** REST (`/api/v1/...`), prefijo global `api/v1`, Swagger UI en `/api/docs`.
- **Base de datos:** `ms_support` (database-per-service).
- **Dependencias externas:** Ninguna (no consume otros microservicios).

## Endpoints

| Metodo | Ruta | Descripcion | Respuesta |
|---|---|---|---|
| GET | `/api/v1/mensajes` | Listar todos los mensajes de contacto | 200 |
| GET | `/api/v1/mensajes/:id` | Obtener un mensaje por su identificador | 200 / 404 |
| POST | `/api/v1/mensajes` | Crear un mensaje de contacto | 201 + `Location` |
| PUT | `/api/v1/mensajes/:id` | Reemplazar un mensaje | 204 |
| PATCH | `/api/v1/mensajes/:id` | Actualizar parcialmente un mensaje | 200 / 404 |
| DELETE | `/api/v1/mensajes/:id` | Eliminar un mensaje | 204 |

## Base de datos

El esquema y los datos iniciales se encuentran en `init-support.sql`
(tables: `mensaje_contacto` y domain `dom_correo`).

## Ejecucion local

```bash
# 1. Levantar PostgreSQL (Docker)
docker compose up -d

# 2. Aplicar esquema y datos iniciales
psql -U postgres -d ms_support -f init-support.sql

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
