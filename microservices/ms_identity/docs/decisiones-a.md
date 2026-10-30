# Decisiones de fase A

Se inspeccionaron completamente flujo_trabajo.md, SQL v2 y el OpenAPI externo.
El usuario aprobó el diseño y autorizó B con «Vamos con la fase B» y «Retoma la Fase B».
No se autoriza avanzar a C sin nueva aprobación.

- Reutilizar microservices/ms_identity con nombre ms-identity y raíz Git propia.
- NestJS, TypeScript, PostgreSQL 16, TypeORM sin DDL automático, Jest y Supertest.
- API /api/v2; Swagger /api/docs en F. Docker local, sin despliegue.
- C preservará exactamente las cinco tablas, dominios, índices, trigger, vista y roles del SQL.
- No ejecutar las otras quince bases ni añadir tablas de negocio ajenas o historial ORM.
- Mailpit local para capturar correo sin proveedores externos.
- Registro exclusivamente CLIENTE; campos administrativos nunca se aceptan del cliente.
- JWT propuesto: RS256; issuer urn:descubreec:identity; audience access
  urn:descubreec:internal-api; audience refresh urn:descubreec:identity:refresh.
- Access de 15 minutos; sesión absoluta de siete días; sub BIGINT como string,
  sid UUID y jti aleatorio; validación separada de access y refresh.
- Refresh rotativo firmado, hash SHA-256 en sesion y control transaccional de reutilización.
- Token de correo/recuperación aleatorio, de un uso, hash SHA-256 en tokv_token;
  64 caracteres caben en VARCHAR(128), sin cambiar el esquema.
- Login antes de verificar correo, conservando verified=false y verificando usuario/roles activos.
- Login y recuperación genéricos; registro duplicado 409 es una excepción explícita a no enumeración.
- Bootstrap ADMIN local por comando, explícito, idempotente, con contraseña aleatoria;
  no promueve cuentas preexistentes no administrativas. Se implementará en E.
- Otros servicios necesitan acordar comprobación de vigencia; firma local no implica revocación inmediata.

El OpenAPI externo no contiene las rutas Identity. Tiene claves duplicadas en
TimeSlotItem (primera en línea 1688), por lo que falla parseo YAML estricto.
No se modificó. Las menciones a Render no autorizan despliegue.

B solo incorpora dos sondas técnicas para verificar proceso y conexión. No se
publican endpoints de autenticación inexistentes como operativos.
