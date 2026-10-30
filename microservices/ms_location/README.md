# MS Location Service

Microservicio de geografia del Sistema de Atracciones (Descubre EC).

- **Responsabilidad:** Gestionar regiones, provincias, ciudades y coordenadas de atracciones.
- **Contrato:** REST en `/api/v2`; escrituras ADMIN protegidas por JWT RS256 y validacion AJV.
- **Base de datos:** `ms_location` (database-per-service).
- **Dependencias externas:** Ninguna (no consume otros microservicios).

## Endpoints

| Metodo | Ruta | Descripcion | Respuesta |
|---|---|---|---|
| GET | `/api/v2/regiones` | Listar regiones | 200 |
| GET | `/api/v2/regiones/:id` | Obtener region por id | 200 / 404 |
| POST | `/api/v2/regiones` | Crear region (ADMIN) | 201 |
| PUT/PATCH/DELETE | `/api/v2/regiones/:id` | Gestionar region (ADMIN) | 200/204 |

| Metodo | Ruta | Descripcion | Respuesta |
|---|---|---|---|
| GET | `/api/v2/provincias` | Listar provincias (filtro `?reg_id=`) | 200 |
| GET | `/api/v2/provincias/:id` | Obtener provincia por id | 200 / 404 |
| POST | `/api/v2/provincias` | Crear provincia (ADMIN) | 201 |
| PUT/PATCH/DELETE | `/api/v2/provincias/:id` | Gestionar provincia (ADMIN) | 200/204 |

| Metodo | Ruta | Descripcion | Respuesta |
|---|---|---|---|
| GET | `/api/v2/ciudades` | Listar ciudades (filtro `?prov_id=`) | 200 |
| GET | `/api/v2/ciudades/:id` | Obtener ciudad por id | 200 / 404 |
| POST | `/api/v2/ciudades` | Crear ciudad (ADMIN) | 201 |
| PUT/PATCH/DELETE | `/api/v2/ciudades/:id` | Gestionar ciudad (ADMIN) | 200/204 |
| GET | `/api/v2/locations/attractions/:atrId` | Coordenadas y division geografica | 200 / 404 |
| PUT | `/api/v2/locations/attractions/:atrId` | Crear/actualizar coordenadas (ADMIN) | 200 |

## Base de datos

El esquema y los datos iniciales se encuentran en `init-location.sql`
(`region`, `provincia`, `ciudad`, `atraccion_ubicacion` y seeds de Ecuador).
En una base existente puede aplicarse solo `database/attraction-location.sql`.

## Ejecucion local

```bash
# 1. Crear la configuracion local (PowerShell; no sobrescribir un .env existente)
Copy-Item .env.example .env

# 2. Levantar PostgreSQL 16
docker compose up -d --wait

# 3. Levantar el microservicio
npm run start:dev
```

Compose publica PostgreSQL en `localhost:5435` (puerto interno `5432`), por lo que
`DATABASE_URL` debe apuntar al puerto `5435`. El contenedor crea `ms_location` y
ejecuta `init-location.sql` al inicializar un volumen nuevo. PostgreSQL no vuelve a
ejecutar esos scripts si el volumen `pg_ms_location_data` ya existia; en ese caso,
verifica la base dentro del contenedor con:

```bash
docker exec -it pg_ms_location psql -U postgres -d postgres
```

Si `ms_location` no existe, creala con `CREATE DATABASE ms_location;` y luego aplica
el esquema desde PowerShell:

```powershell
Get-Content .\init-location.sql -Raw | docker exec -i pg_ms_location psql -U postgres -d ms_location
```

El puerto local por defecto es `3019`; lee `.env.example` para la configuracion.

## Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## Despliegue

Fuera de alcance en esta fase (solo se requiere el microservicio listo y funcional).
