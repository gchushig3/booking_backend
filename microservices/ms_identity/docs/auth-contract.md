# Contrato de autenticación — fase D

Contrato interno aprobado en A; Booking no define estas operaciones. Base `/api/v2`.
JSON; nombres desconocidos producen 400. No hay cookies ni sesión de navegador implícita.
Respuestas de autenticación llevan `Cache-Control: no-store` y `X-Correlation-Id`.
Errores usan `application/problem+json`, sin SQL, hashes ni trazas.

| Método y ruta                  | Acceso                                     | Entrada                                | Éxito                                   |
| ------------------------------ | ------------------------------------------ | -------------------------------------- | --------------------------------------- |
| POST /auth/register            | Público, límite recovery                   | email, password, first_name, last_name | 201: user, verification_email_sent      |
| POST /auth/login               | Público, límite login                      | email, password                        | 200: par de tokens                      |
| POST /auth/refresh             | Público, límite token                      | refresh_token válido                   | 200: nuevo par de tokens                |
| POST /auth/verify-email        | Público, límite recovery                   | token                                  | 204                                     |
| POST /auth/resend-verification | Público, límite recovery                   | email                                  | 200: mensaje genérico                   |
| POST /auth/forgot-password     | Público, límite recovery                   | email                                  | 200: mensaje genérico                   |
| POST /auth/reset-password      | Público, límite recovery                   | token, new_password                    | 204; revoca todas las sesiones          |
| GET /auth/me                   | Bearer, usuario/sesión y algún rol activos | —                                      | 200: user, session_id                   |
| POST /auth/logout              | Bearer                                     | —                                      | 204; revoca la sesión actual            |
| POST /auth/logout-all          | Bearer                                     | —                                      | 204; revoca todas las propias           |
| GET /auth/sessions             | Bearer                                     | —                                      | 200: array de sesiones propias vigentes |
| DELETE /auth/sessions/:id      | Bearer, propiedad                          | UUID v4                                | 204; ajena/inexistente: 404             |
| PATCH /auth/change-password    | Bearer                                     | current_password, new_password         | 204; revoca todas las sesiones          |
| GET /.well-known/jwks.json     | Público                                    | —                                      | 200: JWKS público; caché 60 segundos    |
| GET /health/live               | Público                                    | —                                      | 200                                     |
| GET /health/ready              | Público                                    | —                                      | 200; PostgreSQL inaccesible: 503        |

Todos los campos de entrada indicados son obligatorios. Email máximo 160, trim y
minúsculas, regex idéntica a dom_correo. Nombres trim, no vacíos, máximo 120.
Contraseña nueva: mínimo 12 caracteres Unicode y máximo 72 bytes UTF-8, sin NUL;
no se normaliza ni recorta. Login/current_password permiten contraseñas existentes
de 1–72 bytes. Token opaco: 43 caracteres base64url; refresh máximo 8192.
Campos como roles, active, verified, id o hash están prohibidos en registro.

`user` incluye id BIGINT string, email, first_name, last_name, document, phone,
birth_date, avatar_url, verified, active, roles, last_login_at, created_at y updated_at.
Los opcionales SQL se devuelven null. Fechas temporales se serializan ISO 8601.
Sesiones: id UUID, ip, user_agent, expires_at, created_at, current; nunca hashes.
Par: access_token, refresh_token, token_type=`Bearer`, expires_in en segundos y
refresh_expires_at ISO 8601. No hay concesión ADMIN en estas rutas.

## Errores y permisos

- 400: DTO inválido, campo extra, token opaco inválido/usado/expirado o mismo password al cambiar.
- 401: credenciales, firma, audience, tipo, expiración o sesión inválidos; usuario inactivo.
- 403: JWT/sesión válidos sin roles actualmente activos. Las políticas administrativas vienen en E.
- 404: sesión ajena o inexistente. `/users` y `/roles` están documentados en el contrato de autorización E.
- 409: correo ya registrado; excepción explícita aprobada a la respuesta genérica.
- 429: exceso temporal de solicitudes; `Retry-After` indica segundos para reintentar.
- 500/503: error interno/dependencia; mensajes seguros.

Login desconocido y contraseña incorrecta comparten mensaje; ambos ejecutan bcrypt.
Forgot/resend devuelven el mismo mensaje para cuentas desconocidas, inactivas y elegibles.
La implementación SMTP local es síncrona: no se ofrece una garantía de tiempo constante
ni un outbox ficticio. Un fallo SMTP de registro se indica con
verification_email_sent=false; el usuario se conserva y puede pedir reenvío.
Forgot/resend no revelan fallos de entrega al consumidor; se registra solo un código seguro.

Límites por ruta y por IP y correo normalizado (SHA-256, sin correo en memoria del
limitador): login 5/minuto, recovery 3/15 minutos, refresh 30/minuto. El límite por
IP también alcanza verify/reset, que no reciben email. Registro usa recovery.
Se cuenta cualquier intento, incluidos errores; no se bloquea permanentemente una cuenta.
El estado está en memoria y se reinicia con app: válido para el entorno local de
una instancia, requiere acuerdo de almacenamiento compartido antes de escalar.
No se confía en X-Forwarded-For; desplegar detrás de proxy necesita configuración aprobada.

## Flujo local ejecutable

1. Ejecutar los comandos del README y abrir Mailpit en http://localhost:8025.
2. POST http://localhost:3011/api/v2/auth/register con
   `{"email":"persona@example.test","password":"Una-clave-local-segura-42!","first_name":"Ana","last_name":"Prueba"}`.
   Es un ejemplo; elegir una contraseña propia. El rol inicial siempre es CLIENTE.
3. Abrir el correo capturado y POST /auth/verify-email con `{"token":"<token del correo>"}`.
4. POST /auth/login con email/password, sin Authorization. Se permite login antes
   de verificar, manteniendo verified=false; no concede privilegios adicionales.
5. GET /auth/me enviando `Authorization: Bearer <access_token>`.
6. POST /auth/refresh con refresh_token; reemplazar ambos tokens guardados.
7. POST /auth/logout con access token; el mismo access y refresh dejan de funcionar.
8. Para recuperación, POST /auth/forgot-password, leer el token en Mailpit y POST
   /auth/reset-password con token/new_password. El token se consume una sola vez.

Correo/recuperación usan 32 bytes aleatorios criptográficos, SHA-256 hex en
tokv_token (64 de 128 caracteres), vencimiento 24h/15min. Reenvío invalida el anterior.
Verificar invalida todos los tokens EMAIL pendientes. Recuperar/cambiar contraseña
invalida los RECUPERACION pendientes y todas las sesiones. Las transacciones
bloquean usuario antes que sesión/token, serializando cambios y usos concurrentes.
No se añade ninguna tabla, índice ni columna. Correo real externo no está configurado:
APP_ENV=production se rechaza al inicializar este transporte local.

`/users/me`, administración de usuarios/roles y bootstrap ADMIN están implementados
en E; consultar [contrato de autorización](authorization-contract.md).
Swagger /api/docs y OpenAPI exportado están disponibles desde F; el documento
JSON/YAML incluye únicamente las operaciones realmente implementadas.
