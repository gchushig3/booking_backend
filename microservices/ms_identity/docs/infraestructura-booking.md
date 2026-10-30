# Neon y consumidores Booking

`AppModule` importa `NeonDatabaseModule.forRootAsync` con las entidades oficiales y la
extension existente de dominios PostgreSQL. `DATABASE_URL` tiene prioridad sobre DB\_\* y
fuerza SSL con `rejectUnauthorized: false`; PostgreSQL local sigue disponible sin esa URL.
No se aplican cambios automaticos al esquema.

Se conserva el flujo existente: `POST /api/v2/auth/register` registra solo CLIENTE con bcrypt
y verificacion de correo; `POST /api/v2/auth/login` emite JWT **RS256** con access/refresh,
rotacion y revocacion de sesiones. Configurar SMTP y `JWT_KEYRING_PATH`; `JWT_SECRET` no se usa.
`auth.schemas.ts` agrega validacion JSON Schema antes de transformar DTOs, conservando las
politicas existentes de passwords y normalizacion de correo.

`BOOKING_API_KEY` es obligatoria, con al menos 32 caracteres, y debe compartirse solo con los
servicios consumidores autorizados. Los `.env` existentes no se sobrescriben: agregar la clave.
`npm run env:local` la genera para archivos nuevos. Endpoints protegidos por `X-API-Key`:

- `GET /api/v2/auth/booking/verify-api-key`: verifica credenciales de consumidor.
- `POST /api/v2/auth/booking/introspect`, cuerpo `{ "access_token": "..." }`: verifica firma,
  emisor, audiencia, caducidad, usuario activo, sesion no revocada y roles activos en PostgreSQL;
  devuelve `{ userId, sessionId, roles }`. Una API Key no reemplaza el JWT de usuario.

Desde `../shared-infrastructure`: `npm ci` y `npm run build`; despues, en este servicio: `npm ci`.
Para Docker, ejecutar desde la raiz del repositorio:
`docker build -f microservices/ms_identity/Dockerfile -t ms-identity .`.
Las pruebas de infraestructura usan dobles para servicios externos; no prueban credenciales de nube.
