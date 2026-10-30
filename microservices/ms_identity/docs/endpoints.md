# Matriz final de endpoints Identity

Base /api/v2. Generada desde docs/openapi.json; las 25 operaciones corresponden a controladores reales.

| Método | Ruta                              | Acceso                             | Éxito |
| ------ | --------------------------------- | ---------------------------------- | ----- |
| GET    | /api/v2/health/live               | Público                            | 200   |
| GET    | /api/v2/health/ready              | Público                            | 200   |
| POST   | /api/v2/auth/register             | Público                            | 201   |
| POST   | /api/v2/auth/login                | Público                            | 200   |
| POST   | /api/v2/auth/refresh              | Público                            | 200   |
| POST   | /api/v2/auth/verify-email         | Público                            | 204   |
| POST   | /api/v2/auth/resend-verification  | Público                            | 200   |
| POST   | /api/v2/auth/forgot-password      | Público                            | 200   |
| POST   | /api/v2/auth/reset-password       | Público                            | 204   |
| GET    | /api/v2/auth/me                   | Bearer, usuario/sesión/rol activos | 200   |
| POST   | /api/v2/auth/logout               | Bearer, usuario/sesión/rol activos | 204   |
| POST   | /api/v2/auth/logout-all           | Bearer, usuario/sesión/rol activos | 204   |
| GET    | /api/v2/auth/sessions             | Bearer, usuario/sesión/rol activos | 200   |
| DELETE | /api/v2/auth/sessions/{id}        | Bearer, usuario/sesión/rol activos | 204   |
| PATCH  | /api/v2/auth/change-password      | Bearer, usuario/sesión/rol activos | 204   |
| GET    | /api/v2/.well-known/jwks.json     | Público                            | 200   |
| GET    | /api/v2/users/me                  | Bearer, usuario/sesión/rol activos | 200   |
| PATCH  | /api/v2/users/me                  | Bearer, usuario/sesión/rol activos | 200   |
| GET    | /api/v2/users                     | ADMIN activo                       | 200   |
| GET    | /api/v2/users/{id}                | ADMIN activo                       | 200   |
| PATCH  | /api/v2/users/{id}/status         | ADMIN activo                       | 200   |
| GET    | /api/v2/users/{id}/roles          | ADMIN activo                       | 200   |
| POST   | /api/v2/users/{id}/roles          | ADMIN activo                       | 201   |
| DELETE | /api/v2/users/{id}/roles/{roleId} | ADMIN activo                       | 204   |
| GET    | /api/v2/roles                     | ADMIN activo                       | 200   |

Swagger y documentos /api/docs, /api/docs-json y /api/docs-yaml son públicos localmente y no requieren Bearer. No cuentan como operaciones de negocio.

DTOs, errores y reglas: [autenticación](auth-contract.md), [autorización](authorization-contract.md), [JWT](jwt-contract.md) y [OpenAPI](openapi.yaml).
