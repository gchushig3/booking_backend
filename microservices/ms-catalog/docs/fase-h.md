# Fase H — Revisión y entrega técnica local

Fecha: 2026-10-28, America/Guayaquil. Autorización explícita: «Sii vamos con la fase H».

## 1. Resumen

Se revisaron seguridad efectiva, persistencia, límites entre servicios, documentación,
inicialización y ejecución local. Se consolidó una guía de entrega con resultados
verificables y un registro de decisiones e integraciones pendientes.

La revisión encontró y corrigió la pérdida de valores inválidos durante la transformación
de DTOs opcionales. Se añadieron regresiones, se ejecutaron las suites completas y se
reconstruyó el contenedor local. La evidencia H se guardó sin sustituir la evidencia G.

La entrega local queda preparada para recepción técnica. No se declara completado el
objetivo de administración con JWT/RBAC ni se habilitan rutas sin contratos aprobados.

## 2. Archivos creados o modificados

Nuevos:

- `docs/entrega-tecnica.md`: guía de recepción, estructura, ejecución, pruebas,
  operación local y matriz de aceptación.
- `docs/integraciones-pendientes.md`: contratos necesarios, responsables por servicio,
  decisiones abiertas y revisiones antes de abrir administración.
- `docs/fase-h.md`: informe final de la fase.
- `docs/fase-h-evidence.json`: imagen, versiones, esquema, controles del contenedor,
  comprobaciones HTTP y persistencia de la entrega.
- `test/unit/dto-transformation.spec.ts`: 24 casos de validación y conversiones de DTOs.

Modificados:

- `src/common/dto/dto-utils.ts`: conserva valores inválidos para que los decoradores
  de validación existentes los rechacen, en lugar de convertirlos en ausencia.
- `test/integration/http.integration-spec.ts`: cuatro casos adicionales de filtros
  opcionales inválidos por query y body contra AppModule/PostgreSQL real.
- `scripts/verify-local-stack.mjs`: comprueba esos cuatro errores HTTP y permite
  `--phase=h` para guardar evidencia separada.
- `README.md`: estado H, navegación de entrega, comandos reproducibles y eliminación
  de la matriz histórica duplicada que podía confundirse con acceso operativo.

No se cambió esquema, contrato externo, lista de endpoints, dependencias, secretos
locales, otros microservicios ni configuración de infraestructura externa.

## 3. Decisiones técnicas aplicadas

Una entrada inválida suministrada no debe transformarse en `undefined` y evitar
`@IsOptional`/`@IsInt`/`@IsBoolean`/`@IsString`/`@IsIn`. Los valores numéricos inválidos
llegan como NaN a la validación; los booleanos y textos de tipo inválido se conservan
para rechazo. Las conversiones válidas documentadas, campos omitidos y defaults
siguen funcionando. No se añadieron campos ni restricciones SQL.

Se mantiene denegación global por defecto, consultas públicas expresas, DDL automático
deshabilitado, repositorios exclusivamente locales y proyecciones Review de solo
lectura en los mapeos. La revisión es acotada; no es una auditoría de seguridad exhaustiva.

## 4. Contratos entregados

La matriz vigente es `docs/endpoints.md`: 38 operaciones, de las cuales siete son
consultas públicas de negocio, una es liveness y 30 están bloqueadas por Identity.
OpenAPI 3 está en `docs/openapi.yaml` y se sirve en `/api/docs-json` y `/api/docs-yaml`;
Swagger UI está en `/api/docs`. La API interna mantiene `/api/v2`.

Los nuevos casos HTTP inválidos devuelven `400 VALIDATION_ERROR` con
`application/problem+json`. La administración sigue devolviendo
`401 AUTHENTICATION_UNAVAILABLE` para cualquier token. No hay permisos concedidos,
claims inventados ni pruebas de identidad real simuladas como integración.

## 5. Comandos y revisiones ejecutados

Desde `microservices/ms-catalog`:

```sh
git status --short
git rev-parse --show-toplevel
git check-ignore .env .env.test node_modules dist
npm.cmd test -- --runTestsByPath test/unit/dto-transformation.spec.ts
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run test:integration
npm.cmd run openapi:check
docker compose config --quiet
docker compose up -d --build --wait --wait-timeout 120
node scripts/verify-local-stack.mjs --phase=h
npm.cmd run format:check
```

Se ejecutó Prettier sobre archivos cambiados. `openapi:check` ejecutó `nest build`.
La revisión adicional comprobó huella SHA-256 de la migración, exclusión Git de
entornos y ausencia de las contraseñas locales de `.env`/`.env.test` en candidatos
Git no ignorados, sin mostrar valores. Esto no equivale a detectar todo secreto posible.

## 6. Resultados reales

| Comprobación                                            | Resultado                                   |
| ------------------------------------------------------- | ------------------------------------------- |
| Lint, formato y typecheck                               | Aprobados                                   |
| Build local y rebuild Docker                            | Aprobados                                   |
| Unitarias                                               | 76 aprobadas, 8 suites                      |
| E2E HTTP                                                | 57 aprobadas, 3 suites                      |
| Integración PostgreSQL/HTTP real                        | 68 aprobadas, 2 suites                      |
| Total Jest                                              | 201 aprobadas, 13 suites                    |
| OpenAPI y matriz coinciden con generación               | Aprobado                                    |
| Swagger, consultas públicas y 30 denegaciones en Docker | Aprobado                                    |
| Cuatro filtros inválidos en Docker                      | 400 comprobado antes y después del reinicio |
| Persistencia del mismo volumen y datos tras reinicio    | Aprobado                                    |
| Contraseñas locales en candidatos Git revisados         | Ninguna coincidencia                        |
| Huella del SQL aprobado                                 | Coincide                                    |

Los detalles de imagen, versión PostgreSQL, instante UTC y snapshots están en
`fase-h-evidence.json`. Las comprobaciones no insertaron datos operativos de ejemplo.
Aplicación y PostgreSQL local se conservaron en ejecución; la base de pruebas sigue
separada en el puerto 5445.

No se repitió bootstrap/rollback de G porque no cambió SQL, inicializador ni Dockerfile.
Se conserva aquella evidencia y no se atribuye su ejecución a H.

## 7. Errores encontrados

La regresión inicial de DTOs obtuvo ocho fallos y doce casos aprobados: entradas
inválidas numéricas/booleanas se omitían o se convertían a valores válidos. Se corrigió
la causa y se extendió la prueba a texto/enum/fotografía opcionales: los 24 casos
finales pasan. Las cuatro regresiones HTTP reales también pasan.

Se corrigieron incoherencias del README: estado de fase, ausencia de instrucciones
para arrancar el stack antes del smoke test y tabla histórica duplicada que mostraba
operaciones administrativas como implementadas sin reflejar su bloqueo actual.

## 8. Riesgos y pendientes

`integraciones-pendientes.md` es el registro de cierre. Los bloqueos principales son
el contrato Identity y la matriz de autorización, la verificación de propiedad por
operador, la ratificación del contrato administrativo y las decisiones de publicación.
Location, Review y composición Booking siguen sin adaptadores ficticios.

La revisión señala además la resolución bigint/integer de operadores y las carreras
concurrentes de jerarquía/borrado para resolver antes de habilitar administración.
No se afirma que esos casos administrativos estén probados o completos.

El stack es local: liveness, usuario de bootstrap y redes de desarrollo no equivalen
a configuración operativa para Azure. Tampoco se prueba backup/restore, inspección
visual de Swagger ni recuperación ante pérdida del volumen.

## 9. Criterios de aceptación

Se entregan código compilable, documentación de ejecución e inicialización, comandos
de pruebas, contrato OpenAPI, matriz de endpoints, resultados reales y lista de
integraciones pendientes. La seguridad existente deniega administración por defecto
y preserva la separación de datos. No hubo despliegue, publicación de imágenes,
recursos Azure, Render ni pipelines CD.

Los criterios de JWT/RBAC real, propiedad y operaciones HTTP administrativas
autorizadas permanecen bloqueados. Por tanto, finalizar H significa entregar el
alcance local comprobado, no declarar que el objetivo completo ya está alcanzado.

## 10. Recepción y autorización posterior

No se inicia ninguna fase posterior. La recepción técnica local puede revisarse con
`entrega-tecnica.md`. Para continuar con administración operativa se requiere el
contrato Identity, las decisiones listadas y autorización explícita para ese trabajo.
No se crearon commits ni se publicó el repositorio; cualquier publicación o
despliegue queda fuera de esta entrega.
