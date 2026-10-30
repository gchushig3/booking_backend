# Integraciones y decisiones posteriores a la entrega local

Identity entrega contratos y endpoints reales. Las siguientes conexiones no se
presentan como implementadas ni se activan automáticamente con esta entrega.

| Área / responsable                    | Disponible en Identity                                                                | Trabajo pendiente fuera de esta entrega                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| ms_catalog                            | JWT RS256, JWKS público y auth/me con comprobación viva                               | Consumir contrato, configurar verificación confiable y acordar vigencia; mantener autorización de operador/propiedad en operador_usuario de Catalog |
| Otros microservicios                  | sub BIGINT string y roles activos al emitir; perfil propio y administración protegida | Acordar permisos y referencias lógicas por servicio; sin compartir tablas ni FK externas                                                            |
| Vigencia y revocación en consumidores | Revocación inmediata comprobada en rutas Identity; GET /api/v2/auth/me disponible     | Elegir validación viva o política offline aprobada; verificar firma no garantiza conocer revocaciones/cambios de roles al instante                  |
| integration-booking                   | Contrato interno /api/v2 documentado                                                  | Aprobar composición/mapeo que requiera Identity; Booking /api/v3 no define todas estas rutas ni se implementa dentro de Identity                    |
| Correo externo                        | Mailpit SMTP local real y tokens de un uso                                            | Aprobar transporte de producción y entrega/reintentos; no hay outbox ni proveedor externo ficticio                                                  |
| Claves de producción                  | Claves locales persistentes, JWKS y comando de rotación local                         | Aprobar custodia/distribución/rotación operacional y TLS; claves privadas no se comparten con consumidores                                          |
| Rate limit con varias instancias      | Límites por IP/email en memoria de una instancia                                      | Acordar almacenamiento compartido antes de escalar; no crear tablas adicionales sin aprobación                                                      |
| Operación y observabilidad            | Logs JSON, Problem Details, correlación y sondas locales                              | Aprobar telemetría/alertas y configuración de operación de producción; no se conectó Observe ni otro destino externo                                |
| Eventos                               | Persistencia y REST aprobados                                                         | Cualquier evento, publicación o consumidor exige contrato formal; no se implementaron consumidores simulados                                        |
| Infraestructura futura                | Dockerfile multietapa y Compose local                                                 | Evaluación posterior de Azure; sin recursos, CD, despliegue ni publicación de imágenes en esta fase                                                 |

Un rol OPERADOR no demuestra propiedad de una atracción ni asociación con un
operador comercial. Esa política sigue en el servicio propietario. Identity no
consulta bases Catalog/Location/Pricing/Booking ni duplica sus tablas.

El OpenAPI externo Booking original mantiene la incompatibilidad por claves YAML
duplicadas identificada en A. No se corrigió ni se cambió silenciosamente; cualquier
ajuste debe aprobarse con su propietario. El OpenAPI interno Identity sí se valida
y exporta como JSON/YAML desde los controladores reales.

Referencias: [contrato JWT](jwt-contract.md), [autenticación](auth-contract.md),
[autorización](authorization-contract.md) y [OpenAPI interno](openapi.yaml).
