# Fase 2.8.3 — Swagger UI y REST v2

Fecha: 2026-10-28, America/Guayaquil. **Completada para revisión local, sin despliegue a Render.** Swagger en `/api/docs`; negocio en `/api/v2`. API simulada, sin JWT/autorización HTTP ni pagos reales.

## 1. Objetivo y fuentes

Publicar documentación navegable a partir del contrato API-first y establecer REST v2 sin cambiar negocio. Se siguió [flujo_trabajo.md](../../flujo_trabajo.md): diseño primero, Swagger/validación global, pruebas HTTP con persistencia aislada y documentación de entrega. El ejemplo v1 de esa guía no obliga a conservar v1 como ruta activa: esta fase autoriza explícitamente v2.

Se revisaron README, contrato, main/AppModule, todos los controladores, DTOs de entrada/salida, tests unitarios/e2e/integración, package/lock y referencias de versión. No se modificó SQL ni el contrato general de Atracciones.

## 2. Estado inicial real

La línea base aprobada era193 unitarias,11 e2e y54 integración. El árbol encontrado ya tenía una migración parcial: main, Location y pruebas HTTP usaban `/api/v2`; `@nestjs/swagger@12.0.5` estaba instalado como dependencia directa, pero no configurado. El archivo v1 había sido sustituido por un v2 que aún decía info.version1.1.0. README y auditoría BigId seguían apuntando a v1, que faltaba físicamente.

Se conservaron los cambios previos coherentes con el objetivo y se completó la migración. No se atribuye a esta fase todo el diff acumulado de Git de fases anteriores. Se recuperó la copia histórica v1 exacta y se comprobó contra hashes registrados antes de la migración.

## 3. Inventario de referencias v1

Inventario previo a editar:18 líneas con api/v1 o nombre del contrato v1, excluyendo dependencias/dist/.tmp. No se hizo sustitución global.

| Categoría / ubicación inicial | Referencias encontradas | Tratamiento |
|---|---:|---|
| README.md |3: rutas de ambos detalles y simulaciones | Documentación operativa reemplazada por v2; se conserva enlace histórico v1 |
| src/common/pipes/bigint-id.audit.spec.ts |1: lectura del contrato canónico v1 | Ahora contrasta el YAML v2 vigente |
| docs/auditoria-fase-2.5.md |3 | Históricas, intactas |
| docs/fase-2.6-bigid.md |2 | Históricas, intactas |
| docs/fase-2.6-evidencia.json |1 | Evidencia histórica intacta |
| docs/fase-2.7-diseno-seguridad.md |4 | Históricas, intactas |
| docs/fase-2.8.2-a-contratos-integracion-seguridad.md |4 | Históricas, intactas |
| Rutas/Location/tests de negocio al iniciar | Ya estaban en v2 | Validados; no se duplicó prefijo en decoradores |
| Contrato v1 al iniciar | Ausente, aparecía eliminado en Git | Restaurado byte a byte al contenido pre-migración |

La referencia v1 nueva en pruebas de ausencia de alias es intencional: exige404, no mantiene compatibilidad. Referencias v1 en README e informes se etiquetan como históricas; no son servidores de la especificación v2.

## 4. Decisiones de versión y contrato

- Fuente vigente: `contract/ms_payment-openapi-v2.yaml`, OpenAPI3.0.3 e info.version2.0.0, servidor `http://localhost:3000/api/v2`.
- Permanece **CONTRATO PROPUESTO, NO OFICIAL**, sin alterar su estado de aprobación general.
- V1 se conserva en `contract/ms_payment-openapi-v1.yaml`, versión interna1.1.0 histórica, sin alias REST.
- Las doce operaciones, paths relativos, parámetros, cuerpos, estados HTTP, esquemas y reglas de negocio se preservan. Solo cambia la versión/base y el ejemplo Location de creación; se amplía la descripción para declarar ausencia de seguridad y naturaleza local de Swagger.
- Comparación automatizada: componentes v2 idénticos a v1; paths idénticos tras sustituir únicamente el ejemplo `/api/v1/` por `/api/v2/`. No se añaden401/403 de JWT ni integración remota.
- Un único `setGlobalPrefix('api/v2')`, en la configuración compartida invocada por main. Controladores siguen relativos. No se habilita versionamiento por cabeceras ni un segundo contrato operativo.

## 5. Archivos y alcance de cambios

| Archivo | Cambio de esta fase |
|---|---|
| src/configure-application.ts | Nuevo: prefijo, ValidationPipe y Swagger usando el YAML canónico |
| src/main.ts | Usa la configuración compartida; conserva el bind existente0.0.0.0 y PORT |
| contract/ms_payment-openapi-v2.yaml | Completa versión2.0.0, base v2 y advertencias reales de seguridad |
| contract/ms_payment-openapi-v1.yaml | Restaura copia histórica exacta, sin editar su contenido pre-migración |
| src/common/pipes/bigint-id.audit.spec.ts | Lee el contrato vigente v2, conserva oráculo/casos BigId |
| test/app.e2e-spec.ts | Usa mismo setup de bootstrap y añade18 casos de Swagger/versionamiento |
| test/payment.integration-spec.ts | Usa setup compartido, conserva54 casos de negocio y limpieza |
| package.json / package-lock.json | Parser yaml2.9.1 directo y lock consistente; Swagger directo existente validado |
| README.md | Documentación Payment v2, instalación/inicio/pruebas, seguridad y trazabilidad |
| docs/fase-2.8.3-swagger-v2.md | Este informe |

Location del controlador y sus expectativas unitarias ya estaban en v2 al iniciar y se conservaron. No se tocaron servicios de negocio, entidades, DTOs, pipes productivos, AppModule, filtros, seguridad preparatoria, harness criptográfico o entorno.

## 6. Dependencias y compatibilidad

Instalado y comprobado: `@nestjs/swagger@12.0.5`, peers @nestjs/common/core ^12.0.0 y TypeScript ^5.5.0 o ^6.0.0; engines Node ^20.19.0 o >=22.12.0. El árbol tiene Nest12.3.2, TypeScript6.0.3 y Node24. No hay conflicto de peers en npm ls.

Se añadió únicamente `yaml@2.9.1`, con tipos incluidos y engines Node>=14.6, para leer directamente OpenAPI YAML. npm informó un paquete añadido; no se ejecutó update, --force ni --legacy-peer-deps. No se utiliza un parser transitivo como dependencia no declarada. package-lock quedó actualizado.

La instalación informó5 vulnerabilidades del árbol (2bajas,1moderada,2altas); no se aplicó audit fix --force ni se atribuyen automáticamente al paquete nuevo. Requieren seguimiento separado de dependencias. El postinstall de telemetría de @scarf/scarf estaba bloqueado por política npm y no se autorizó; UI y assets funcionan según pruebas.

## 7. Integración API-first con Swagger

`SwaggerModule.setup` recibe el documento cargado del YAML v2, no `createDocument` sobre controladores sin decoradores. La [API de Nest Swagger](https://docs.nestjs.com/openapi/introduction) admite un documento suministrado y rutas de especificación configurables. No se añadió una segunda definición manual ni decoradores para duplicar DTOs.

El loader lee el archivo relativo a import.meta.url, rechaza claves YAML duplicadas/errores de parseo y comprueba OpenAPI3.0.3/versión2.0.0/paths. Los tests verifican el contenido completo y todas sus referencias. Si falta el contrato o es inválido, falla explícitamente en lugar de servir un spec vacío.

Configuración:

```text
SwaggerModule.setup: api/docs
useGlobalPrefix: false
jsonDocumentUrl: api/docs/openapi.json
raw: json
persistAuthorization: false
validatorUrl: null
```

Se mantiene la advertencia de seguridad en info.description, visible en Swagger. No se envía la especificación a un validador Swagger externo. ValidationPipe permanece con su configuración estricta existente y APP_FILTER no cambia.

Para arranque compilado se debe distribuir **contract/ms_payment-openapi-v2.yaml junto a dist/**. No hay copia manual o generada divergente; el YAML raíz sigue siendo la fuente. Se comprobó el loader compilado ejecutándolo desde .tmp: resolvió correctamente OpenAPI3.0.3, versión2.0.0 y base v2, sin depender del cwd. El requisito de empaquetado está en README; publicar dist solo no es suficiente.

## 8. Doce operaciones contrastadas

La prueba compara el YAML con una lista esperada y con metadatos reales de los cinco controladores; verifica doce pares método/path únicos. No infiere rutas de negocio desde un documento generado que pudiera estar vacío.

| Método | Ruta final |
|---|---|
| GET | /api/v2/metodos-pago |
| GET | /api/v2/metodos-pago/{id} |
| GET | /api/v2/estados-pago |
| GET | /api/v2/estados-pago/{id} |
| POST | /api/v2/pagos |
| GET | /api/v2/pagos |
| GET | /api/v2/pagos/{id} |
| POST | /api/v2/pagos/{id}/simulaciones |
| POST | /api/v2/pagos/{id}/tarjeta |
| GET | /api/v2/pagos/{id}/tarjeta |
| POST | /api/v2/pagos/{id}/transferencia |
| GET | /api/v2/pagos/{id}/transferencia |

Parámetros SMALLINT/BigId, filtro activo, ord_id/estado/metodo/limit/offset, requestBody/oneOf, respuestas, ejemplos y reglas se conservan mediante igualdad de paths/componentes con v1 histórico y regresión HTTP. BigId1..9223372036854775807 permanece string; monto NUMERIC(12,2) positivo con dos decimales permanece string; PAYPHAL conserva su nombre SQL.

## 9. Rutas finales y ausencia de duplicados

- GET `/api/docs`: HTML Swagger,200.
- GET `/api/docs/openapi.json`: especificación completa v2,200.
- Assets locales JS/CSS e init de Swagger bajo `/api/docs/`.
- GET `/api/v2`: Hello World! de plantilla existente; fuera de las doce operaciones de negocio y no añadido al YAML.
- `/api/v2/api/docs`:404, no se duplicó prefijo.
- `/api/v1` y los doce pares método/ruta v1:404; sin alias.

Hay9 paths de recursos en OpenAPI y12 operaciones porque algunos paths comparten GET/POST. No confundir el número de paths con operaciones. Rutas de documentación/assets y raíz de plantilla no se presentan como endpoints de negocio adicionales.

## 10. Seguridad y diferencias documentadas

BearerAuth global y x-required-permission payment:simulate se conservan como intención futura; **no hay JWT ni permisos HTTP implementados**. El botón Authorize de Swagger no activa verificación. El contrato y README lo explicitan. No se añaden claves/tokens ficticios, guards o providers JWT.

Simulación mantiene default false, bloqueo de producción en configuración y servicio, aislamiento test, estado PENDIENTE, requisitos de detalle/motivo y garantías SQL/transaccionales. La fase no habilita el flag. Try it out puede escribir datos en la base del servidor seleccionado: usar solo fixtures/datos ficticios locales; no mueve dinero ni conecta pasarelas reales.

Diferencias previas que no se corrigen incidentalmente: esquema Bearer declarado frente a seguridad inactiva; método desconocido de creación se resuelve por catálogo y422 aunque el esquema usa enum; raíz Hello World! no contractual; prohibición de API simulada en producción no equivale a bloquear todas las lecturas por entorno. Se conservan estos límites y las propuestas de seguridad previas, sin vender Swagger como consola segura de producción.

## 11. Nuevas pruebas de Swagger y versión

Se añadieron18 e2e, manteniendo las11 anteriores:

1. HTML200 en ruta exacta, assets locales e init con servidor/versión/operación v2; rutas equivocadas y raíz v1 ausentes.
2. JSON publicado igual al objeto completo del loader canónico; info/OpenAPI/servers/advertencia y Bearer propuesto.
3. Doce operaciones exactas y únicas contra controladores reales.
4. Todos los `$ref` resueltos por JSON Pointer y preservación de paths/esquemas de v1.
5. BigId string/límites, monto string/validación, catálogo PAYPHAL y simulación prohibida en producción.
6. DTO inválido con campos extra/tipos incorrectos devuelve400 INVALID_REQUEST y el filtro de catálogo sigue normalizado.
7. Doce casos parametrizados que rechazan los métodos/rutas v1 con404.

La auditoría BigId existente ahora lee v2 y conserva sus pruebas generadas. Los54 casos PostgreSQL siguen comprobando creación/Location v2, reintentos200/409, consultas/filtros, ambos detalles, simulaciones y concurrencia. No se debilitan resultados ni se eliminan tests.

## 12. Regresión y aislamiento

| Comando | Resultado |
|---|---|
| npx --no-install tsc --noEmit --incremental false | Cero errores |
| npm run build | Aprobado |
| npm run lint | Aprobado |
| npm test |193 aprobadas,21 archivos |
| npm run test:e2e |29 aprobadas,1 archivo |
| npm run test:integration |54 aprobadas,1 archivo |
| **Total** |**276 aprobadas**,258 previas +18 nuevas |

Se usaron ejecutables .cmd en PowerShell sin alterar políticas de ejecución. La comprobación e2e adicional de raíz v1 también pasó en una segunda ejecución; no fue necesario modificar negocio.

Antes de HTTP, docker inspect confirmó ms_payment_postgres_test running/healthy con5432/tcp publicado únicamente en127.0.0.1:5434. Se verificó configuración efectiva NODE_ENV=test, DB_HOST127.0.0.1, DB_PORT5434 y DB_DATABASE ms_payment_test sin imprimir credenciales. No se conectó a desarrollo.

Las suites conservan checks antes de conectar, synchronize/dropSchema/migrationsRun=false y limpieza parametrizada de sus números propios con verificación de detalles por CASCADE. Consulta posterior independiente confirmó **ms_payment_test y0 filas IT restantes**. No DDL, migraciones, cambios de secuencias, índices, dominios o catálogos.

## 13. Riesgos y pendientes

- No publicar esta API simulada como sistema de pagos productivo; no se hizo despliegue a Render.
- JWT/propiedad de recursos continúan bloqueados por las decisiones externas documentadas en Fase2.8.2-A; Swagger no las resuelve.
- Empaquetar el contrato junto a dist y seleccionar el host/puerto correcto si no se usa3000. No hay fallback silencioso a otro spec.
- El bind0.0.0.0 ya presente permite alcance de red según firewall; esta fase no configura TLS/proxy ni convierte la documentación en consola segura.
- Los5 avisos de dependencias requieren su revisión separada, sin force.
- La versión v2 requiere migrar consumidores v1: no hay compatibilidad implícita ni segundo servidor v1 operativo.

## 14. Evidencias verificables

V1 histórico restaurado coincide con el hash pre-migración registrado en Fase2.8.2-A:

```text
SHA256 ms_payment-openapi-v1.yaml
6e7c0e6056569a47411bcd12ca4d565bce10800b533b4fca93d1902e43ce9162
```

El snapshot del árbol inicial e inventario de referencias se registraron temporalmente en .tmp/fase283-baseline.json, sin secretos publicados. La comparación de archivos confirma cambios limitados a configuración documental/bootstrap, tests legítimos de versión, contratos Payment, dependencias de documentación y README/informe. SQL oficial, inicializadores, contrato general Atracciones, entidades, servicios, AppModule, configuración de entorno y seguridad se preservaron.

La evidencia UI es HTTP automatizada sobre Nest real: HTML/JS/CSS e init más JSON completo, no una afirmación basada solo en200 ni una inspección visual de navegador no realizada. Las referencias y el mapeo de controladores se validan en esa misma suite.

## 15. Conclusión

API-first v2 y Swagger local están integrados, con doce operaciones coherentes, versión pública diferenciada y copia v1 histórica. Validación global, errores y lógica de negocio conservan su comportamiento. La regresión pasa y PostgreSQL permanece aislado. **Sin JWT activo, pagos reales o avance automático a Render.**
