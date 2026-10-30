# Fase 2.5 - Auditoria Payment

Fecha: 2026-10-27 (America/Guayaquil). Alcance: repositorio local disponible; no se consulto ni modifico la base de desarrollo para esta auditoria. Contrato auditado: `contract/ms_payment-openapi-v1.yaml`, version interna **1.1.0**, marcado expresamente como propuesto/no oficial. No se modificaron OpenAPI, SQL, catalogos, dependencias ni validacion publica BigId. No se implemento JWT ni integracion Order.

## Resultado y evidencia

Se conservan las doce operaciones y sus respuestas exitosas. Se corrigieron cuatro defectos comprobables sin ampliar el contrato: errores de framework sin `code`; riesgo de registrar detalles despues de una finalizacion concurrente; prioridad incorrecta de 422 sobre 409 al repetir un detalle existente de un pago finalizado; ejecucion e2e contra desarrollo. La autenticacion sigue ausente y requiere identidad externa definida. Las pruebas exitosas sin Authorization demuestran esa ausencia; el bloqueo de entorno no autentica.

Fuentes inspeccionadas: todos los controladores, servicios, entidades y DTOs de `src/`, pipes, validacion, configuracion, modulos, pruebas unitarias, `test/app.e2e-spec.ts`, `test/payment.integration-spec.ts`, Compose, ejemplos y archivos de entorno (valores sensibles omitidos), `.gitignore`, lockfile y scripts; bloque Payment de `../02_microservicios_v2_bases_de_datos.sql`, `init-payment.sql` y derivado de pruebas; `../../contracts/atracciones-openapi-v3.yaml`, `../../contracts/inventory.proto`, `../flujo_trabajo.md` y README. El README raiz esta vacio; el README del servicio conserva bastante texto de plantilla. No hay implementacion de otros microservicios en este checkout. La comparacion del SQL oficial Payment con el inicializador local, sin comentarios/espacios, dio igualdad.

Versiones instaladas verificadas: Node 24.21.0, Nest core 12.3.2, TypeORM 0.3.31, pg 8.23.1, Vitest 4.1.12. PostgreSQL aislado: 17.11, base `ms_payment_test`, `127.0.0.1:5434`.

## Matriz de las doce operaciones

Leyenda: **C** Conforme; **NC** No conforme; **NV** No verificado; **DE** Pendiente por dependencia externa. Cada celda comienza con su clasificacion. Prefijo comun `/api/v1`. `B` es el patron BigId vigente (incompleto respecto del rango descrito); `S` entero 1..32767. Las clasificaciones C se refieren al contrato vigente, con las reservas explicitas de las tablas siguientes. U: unitarias; E: e2e HTTP real; I: integracion PostgreSQL aislada. La disponibilidad de pruebas no significa cobertura exhaustiva de cada combinacion.

| # | Metodo / ruta | Parametros | Request body / DTO | exito / DTO | Errores HTTP | Seguridad declarada / real | Pruebas |
|---|---|---|---|---|---|---|---|
| 1 | C GET `/metodos-pago` | C `activo` boolean opcional, ParseBoolPipe | C sin body | C 200 `MetodoPagoResponseDto[]` | C 400, ahora con Error.code | DE BearerAuth propuesto; sin guard | C U controlador/servicio; E listado/filtro; I listado |
| 2 | C GET `/metodos-pago/{id}` | C S, SmallIntIdPipe | C sin body | C 200 `MetodoPagoResponseDto` | C 400/404, ahora Error | DE BearerAuth propuesto; sin guard | C U controlador/servicio/pipe; E 200/400/404 |
| 3 | C GET `/estados-pago` | C ninguno | C sin body | C 200 `EstadoPagoResponseDto[]` | C no error funcional declarado | DE BearerAuth propuesto; sin guard | C U controlador/servicio; E/I listado |
| 4 | C GET `/estados-pago/{id}` | C S, SmallIntIdPipe | C sin body | C 200 `EstadoPagoResponseDto` | C 400/404, ahora Error | DE BearerAuth propuesto; sin guard | C U controlador/servicio/pipe; E 200/400/404 |
| 5 | C POST `/pagos` | C ninguno | C `CrearPagoRequestDto` | C 201 `PagoResponseDto` + Location; 200 mismo intento | C 400/409/422 | DE BearerAuth propuesto; sin guard | C U DTO/servicio/controlador; E validacion/bloqueo; I creacion/reintento/carreras |
| 6 | C GET `/pagos` | C `ListarPagosQueryDto`: ord_id B, estado, metodo, limit, offset | C sin body | C 200 `PaginaPagosResponseDto` | C 400 | DE BearerAuth propuesto; sin guard | C U DTO/filtros/orden; E filtros/pagina; NV orden y total filtrado exhaustivos sobre BD |
| 7 | C GET `/pagos/{id}` | C B, BigIntIdPipe | C sin body | C 200 `PagoResponseDto` | C 400/404 | DE BearerAuth propuesto; sin guard | C U servicio/pipe; E 400/404; I creacion y lectura |
| 8 | C POST `/pagos/{id}/simulaciones` | C B, BigIntIdPipe | C `SimularPagoRequestDto` | C 200 `PagoResponseDto` | C 400/403/404/409/422 | DE BearerAuth + `payment:simulate`; NC permiso no aplicado; C restriccion de entorno | C U DTO/servicio/controlador/produccion; E deshabilitado; I resultados/reglas/carreras |
| 9 | C POST `/pagos/{id}/tarjeta` | C B, BigIntIdPipe | C `CrearDetalleTarjetaRequestDto` | C 201 `DetalleTarjetaResponseDto` | C 400/404/409/422, corregidas carrera y prioridad de duplicado | DE BearerAuth propuesto; sin guard | C U DTO/servicio; E bloqueo; I CRUD parcial/reglas/duplicados/carreras |
| 10 | C GET `/pagos/{id}/tarjeta` | C B, BigIntIdPipe | C sin body | C 200 `DetalleTarjetaResponseDto` | C 400/404 | DE BearerAuth propuesto; sin guard | C U servicio; I lectura/ausencia/ID |
| 11 | C POST `/pagos/{id}/transferencia` | C B, BigIntIdPipe | C `CrearDetalleTransferenciaRequestDto` | C 201 `DetalleTransferenciaResponseDto` | C 400/404/409/422, corregidas carrera y prioridad de duplicado | DE BearerAuth propuesto; sin guard | C U DTO/servicio; E bloqueo; I reglas/duplicados/carreras |
| 12 | C GET `/pagos/{id}/transferencia` | C B, BigIntIdPipe | C sin body | C 200 `DetalleTransferenciaResponseDto` | C 400/404 | DE BearerAuth propuesto; sin guard | C U servicio; I lectura/ausencia/ID |

Existe adicionalmente GET `/api/v1` (Hello World!), fuera de las doce operaciones Payment. Es una ruta de plantilla sin escrituras ni finalizacion; decidir su uso como health endpoint en una fase posterior.

### Tipos y validaciones comparadas

| Esquema / DTO o pipe | Contrato e implementacion | Estado |
|---|---|---|
| BigId / pipe, CrearPago.orden_id, ListarPagos.ord_id | String decimal, sin Number; mismo patron publico en tres ubicaciones | C frente al patron; NC frente a descripcion de rango completo; ver propuesta |
| SmallId / SmallIntIdPipe | Parseo decimal seguro, entero positivo hasta 32767 | C |
| CrearPago | numero string 1..30; orden_id B; monto string >0 con exactamente 2 decimales, maximo 9999999999.99 | C |
| CrearPago.metodo_codigo | OpenAPI enum; DTO admite string 1..20 y servicio resuelve catalogo activo; desconocido devuelve 422, como exige la descripcion de la operacion | C para codigos validos y 422 documentado; NC literal enum en DTO; decision pendiente de precedencia 400/422 |
| ListarPagos | ord_id B; estado y metodo enums exactos SQL; limit entero 1..100 default20; offset entero >=0 default0 | C para valores habituales; NV extremos de offset fuera del entero seguro JS/alcance SQL |
| SimularPago | APROBADO sin motivo; RECHAZADO/FALLIDO con motivo string 1..300 y al menos un caracter no blanco | C; validador cruzado implementa oneOf |
| CrearDetalleTarjeta | marca string 1..20, ultimos4 cuatro digitos, titular string 1..120, mes entero1..12, anio entero2020..2100, pais dos mayusculas | C |
| CrearDetalleTransferencia | banco string1..60, numero_comprobante string1..40, fecha YYYY-MM-DD y fecha real estricta; archivo_adjunto opcional nullable string <=500 | C |
| Todos los cuerpos | transform + whitelist + forbidNonWhitelisted; no conversion implicita de numeros financieros | C; se rechazan propiedades extra y numeros JSON para monto/BigId |
| MetodoPago / EstadoPago response | ID number, codigos y nombres de catalogo; flags boolean; seleccion explicita de campos | C |
| Pago response | IDs/monto strings; fechas ISO; campos nullable; catalogos anidados; modo PRUEBAS/DESARROLLO_LOCAL y orden_validacion NO_VALIDADA | C en desarrollo/pruebas; NV semantica de lecturas en produccion, ver limites |
| Pagina response | items, total antes de paginar, limit y offset; orden pag_fecha DESC, pag_id DESC | C inspeccion y U; NV comprobacion exhaustiva de orden/total en PostgreSQL |
| Detalles response | Campos explicitos; IDs strings; fecha transferencia date string; adjunto nullable | C |
| Error | statusCode number, code string, message string, details opcional | C tras filtro; 500 generico sin detalles SQL; validacion no refleja valores |

## Diferencias y correcciones

1. **Errores NC -> C:** SmallIntIdPipe, ParseBoolPipe y los 404 de catalogo producian el error por defecto de Nest sin `code`, requerido por OpenAPI. `ApiExceptionFilter`, registrado mediante APP_FILTER, normaliza errores no estructurados, conserva errores de negocio con codigo y devuelve 500 generico para excepciones desconocidas. No registra SQL ni parametros. Pruebas cubren 400/404 y QueryFailedError con datos sinteticos sensibles.
2. **Carrera detalles NC -> C:** antes se leia PENDIENTE y se insertaba fuera de una transaccion; una finalizacion entre ambas acciones permitia un detalle posterior. Ahora cada creacion bloquea primero la fila padre con `pessimistic_write`, carga relaciones y valida/guarda dentro de la misma transaccion. La simulacion usa el mismo bloqueo. Dos pruebas mantienen una finalizacion sin commit, comprueban la espera real en `pg_stat_activity`, confirman y esperan 422 y ausencia del detalle. No se bloquea un LEFT JOIN nullable. Los 23505 se resuelven despues de rollback.
3. **Duplicado finalizado NC -> C:** antes la comprobacion PENDIENTE antecedia a la existencia del detalle y respondia 422. El contrato exige 409 para un detalle existente incluso identico. La comprobacion de duplicado ahora precede a la de estado, despues del bloqueo. Dos pruebas crean el detalle, simulan y repiten: 409.
4. **Pruebas sobre desarrollo NC -> C:** el script e2e carga `.env.test.local` y comprueba el destino antes de crear Nest. Los tests de defensa cambian temporalmente solo el ConfigService en memoria a puerto5433 y restauran5434 con finally; el DataSource permanece conectado a la base aislada. No intentan una conexion a desarrollo. El validador de entorno conserva su compatibilidad anterior con pruebas de solo lectura en desarrollo; las suites de esta fase no la usan.
5. **Pendiente:** JWT/permisos no implementados; BigId descrito como rango completo aunque el patron excluye parte; discrepancia enum/422; limites de offset sin cota superior. No se alteraron estos puntos contractuales.

## Identidad y propuesta de integracion

| Elemento buscado | Evidencia / estado |
|---|---|
| Servicio autenticador, emisor JWT, guards reutilizables | No hay implementacion disponible en este checkout; DE |
| iss, aud, algoritmo y claves publicas/JWKS | No estan definidos en configuracion ni documentacion disponible; DE |
| Claims identidad, roles/permisos | No hay formato aprobado; solo se propone payment:simulate; DE |
| Convenciones 401/403 | Contrato general v3 declara RFC7807 application/problem+json con UNAUTHORIZED/FORBIDDEN; Payment usa Error JSON y no declara 401; incompatibilidad a resolver antes de JWT |
| API key | Contrato general ofrece API key como alternativa; Payment solo propone Bearer. No trasladar automaticamente esa alternativa |
| Arquitectura | SQL separa bases por servicio e IDs logicos; flujo_trabajo exige contrato, timeouts, no leer otras bases y no inventar gateway; ningun proveedor de identidad documentado |

Propuesta, **sin implementacion**: Payment sera verificador de access tokens del proveedor aprobado, no un nuevo emisor. Confirmar URL exacta `iss` y audiencia especifica (propuesta `ms_payment`, no valor autorizado todavia). Acordar un algoritmo asimetrico unico permitido (RS256 o ES256 segun el proveedor, no ambos por comodidad), claves publicas/JWKS HTTPS de origen configurado y rotacion/cache/timeouts. No usar URLs jku/x5u del token, no aceptar alg=none, no confundir claves HMAC y RSA, no dar acceso si la firma o seleccion de clave falla. Validar firma antes de confiar en claims, ademas de iss, aud, sub no vacio, exp obligatorio y nbf si existe, con tolerancia temporal pequena acordada (propuesta30s). Definir tipo de access token, duracion maxima, revocacion y alcance de tenants/propiedad de orden. No aceptar ID tokens como access tokens por defecto. Estas recomendaciones siguen [RFC8725](https://www.rfc-editor.org/rfc/rfc8725.html).

Aplicacion futura: guard autenticador global valida token y crea principal; guard de permisos comprueba el permiso exacto verificado. Token ausente/invalido/expirado ->401; firma valida sin permiso ->403. Conservar formato Payment salvo aprobacion de convergencia RFC7807; anadir 401 al contrato requeriria aprobacion y no se hace aqui. No confiar exclusivamente en headers del gateway. Definir permisos de lectura, creacion y detalles, mas propiedad/tenant; los DTOs no incluyen identidad del dueno y hoy cualquier cliente puede consultar cualquier pago conocido.

### Modelo payment:simulate

Permiso explicito privilegiado concedido unicamente a identidades de pruebas/desarrollo autorizadas, nunca por el mero hecho de tener un token. Aprobar si se expresa como scope separado por espacios o array de permisos; no aceptar coincidencias parciales ni tomar el permiso del request. La politica propuesta es: firma/claims validos **y** permiso exacto **y** NODE_ENV development/test **y** SIMULATION_ENABLED=true; en test ademas destino aislado. El guard autenticador precede al de permisos; el servicio conserva los bloqueos de entorno y reglas de transicion como defensa adicional. Produccion siempre deniega incluso con permiso valido.

Para tests futuros del guard: tokens firmados verificables por una clave exclusivamente de fixtures o emisor local aprobado; casos de firma incorrecta, alg no permitido, iss/aud incorrectos, exp, nbf, permiso ausente y produccion. Un mock de principal solo sirve para unitarias, nunca como seguridad del servidor. Hoy los tests locales son expresamente no autenticados y solo contra PostgreSQL aislado; no se anadio bypass JWT ni token ficticio.

## Simulaciones y rutas alternativas

C: env.validation establece false si falta SIMULATION_ENABLED y fuerza false en production; PagoService vuelve a comprobar production y flag antes de transaccionar. Pruebas de entorno y servicio verifican ambas defensas. C: creacion siempre PENDIENTE y rechaza produccion; cliente no puede asignar estado, timestamps, autorizacion ni referencia. C: solo POST simulaciones actualiza resultado; no hay PATCH/PUT/DELETE ni otro endpoint para finalizar. Registrar detalles no cambia el estado. C: una transicion unica, motivo obligatorio para no aprobacion, detalle previo para TARJETA, transferencia opcional, regla SQL de una aprobacion por orden. NC/DE: no autentica ni comprueba payment:simulate, aun con flag habilitado.

Limite operacional: el contrato describe una API local prohibida en produccion, pero solo crear y simular tienen bloqueo explicito de produccion; lecturas y creacion de detalles de pagos preexistentes siguen disponibles. No debe inferirse que todo el servicio esta cerrado por NODE_ENV. Resolver politica de despliegue/prohibicion total antes de publicar; no se cambian codigos HTTP por iniciativa de esta auditoria. Tampoco existe restriccion por entorno para leer datos.

## BigId: resultado y propuesta pendiente

PostgreSQL BIGINT va de -9223372036854775808 a 9223372036854775807; el dominio publico de IDs solo debe usar 1..9223372036854775807. Fuente: [PostgreSQL17 Numeric Types](https://www.postgresql.org/docs/17/datatype-numeric.html). La representacion string preserva precision sobre Number.MAX_SAFE_INTEGER.

| Valor string | Patron actual (pipe y dos DTOs) | Positivo BIGINT / propuesta |
|---|---|---|
| 1 | acepta | acepta |
| 9007199254740993 | acepta exactamente | acepta |
| 9200000000000000000 | rechaza | acepta |
| 9220000000000000000 | rechaza | acepta |
| 9223372036854775807 | acepta | acepta |
| 9223372036854775808 | rechaza | rechaza |
| 0 | rechaza | rechaza |
| -1 | rechaza | rechaza |
| abc | rechaza | rechaza |
| 01 / vacio | rechaza | rechaza |

El patron actual acepta hasta 9199999999999999999 y solo los ultimos ocho valores 9223372036854775800..9223372036854775807 del tramo superior. Excluye el intervalo valido 9200000000000000000..9223372036854775799. No se detecto aceptacion de valores superiores al maximo.

Patron completo recomendado, **no aplicado** (tambien en `bigid-proposed-pattern.txt`):

```regex
^(?:[1-9][0-9]{0,17}|[1-8][0-9]{18}|9[0-1][0-9]{17}|92[0-1][0-9]{16}|922[0-2][0-9]{15}|9223[0-2][0-9]{14}|92233[0-6][0-9]{13}|922337[0-1][0-9]{12}|92233720[0-2][0-9]{10}|922337203[0-5][0-9]{9}|9223372036[0-7][0-9]{8}|92233720368[0-4][0-9]{7}|922337203685[0-3][0-9]{6}|9223372036854[0-6][0-9]{5}|92233720368547[0-6][0-9]{4}|922337203685477[0-4][0-9]{3}|9223372036854775[0-7][0-9]{2}|922337203685477580[0-6]|9223372036854775807)$
```

Se construye por prefijos lexicograficos inferiores al maximo y el maximo exacto. Las pruebas de auditoria evaluan los valores pedidos sobre el pipe y ambos DTOs vigentes; evaluan la propuesta separadamente y comprueban 380 limites de prefijos contra BigInt exacto. No importan el candidato al codigo productivo.

Tras aprobacion: actualizar OpenAPI de forma coordinada, centralizar patron en una constante compartida para BigIntIdPipe, CrearPagoRequestDto.orden_id y ListarPagosQueryDto.ord_id, mantener tipos string y maxLength19, ampliar casos HTTP sobre BD aislada y validar salidas BigId. Alternativa mas mantenible para codigo: `^[1-9][0-9]{0,18}$` seguido de `BigInt(value) <= 9223372036854775807n`; el esquema OpenAPI seguiria necesitando un patron con rango equivalente. No convertir a Number. Estas modificaciones quedan pendientes de aprobacion explicita.

## Seguridad de datos

| Hallazgo | Clasificacion y alcance |
|---|---|
| Logging TypeORM y logs de aplicacion | C logging:false, no console/logger de payloads en codigo propio; filtro no expone ni registra SQL/driver. NV logs historicos, proxies y telemetria fuera del checkout |
| DTOs y entidades | C cuerpos estrictos y mapeo explicito de respuestas; ninguna entidad se retorna directamente; no relaciones internas extra |
| PostgreSQL | C consultas parametrizadas; 23505 esperado se traduce a 200/409 segun operacion; otros errores500 genericos sin SQL/valores. No se cambia un error inesperado en 409 generico |
| Errores | C validacion enumera nombres de campos/reglas, no valores; filtro normaliza catalogo y framework. Los nombres de propiedades son entrada del usuario; no tratarlos como log seguro de payload arbitrario |
| Secretos | C archivos .env, .env.test.local y postgres.local.env ignorados y no listados por git ls-files; solo se inspeccionaron/redactaron para informe. NV historial de secretos previos y gestores externos |
| Gitignore | C nombres locales actuales cubiertos; otros nombres futuros de .env requieren revision; no se amplia a ciegas |
| Credenciales | C no hardcoded en src, Compose requiere variables; ejemplos son de configuracion local. NV privilegios de rol productivo, TLS de despliegue y rotacion; Docker POSTGRES_USER crea rol administrativo en laboratorio, no es modelo de minimo privilegio para produccion |
| Aislamiento | C test antes de escrituras exige host127.0.0.1 puerto5434 base ms_payment_test; ambas suites usan destino fijo; synchronize/dropSchema/migrationsRun=false; no se escribio desarrollo |
| Datos prohibidos | C no columnas ni propiedades PAN/CVV/PIN/credenciales bancarias; ultimos4 exactamente4. NV que un usuario no ponga informacion sensible en titular/banco/motivo/adjunto/numero: los textos libres no son un detector de secretos; usar solo fixtures ficticios |
| Adjuntos | C referencia textual hasta500, sin upload ni fetch, no SSRF por este campo en implementacion actual |
| Acceso y propiedad | NC no identidad, autorizacion por recurso ni tenant; DE modelo externo. El permiso simulate no resolveria por si solo lectura ajena |
| Exposicion local | C PostgreSQL Compose enlazado a127.0.0.1; servidor HTTP no limita explicitamente bind a loopback; decidir alcance de red antes de habilitar flag o desplegar |

## Integridad y concurrencia

| Garantia | Resultado verificable |
|---|---|
| Idempotencia | C por numero estable y comparacion exacta orden/metodo/monto, no por Idempotency-Key; reintento equivalente200 sin save, distinto409; UNIQUE resuelve inserciones concurrentes |
| pag_numero unico | C restriccion oficial y pruebas concurrentes equivalentes/incompatibles, incluidas carreras con INSERT sin commit |
| Un aprobado por orden | C ux_pago_orden_aprobado sobre ord_id WHERE pag_aprobado_en IS NOT NULL; simulacion establece timestamp y mapea ese23505 a409; prueba concurrente y rollback |
| Detalle unico | C uq_pago_tarjeta_pag_id y uq_pago_transferencia_pag_id; conflicto409 aun identico y ahora tras finalizacion; carreras reales probadas |
| Simulacion unica | C fila pago FOR UPDATE dentro de transaccion, exige PENDIENTE, update condicional por est_id y affected1, posteriores409 |
| Detalle versus finalizacion | C tras correccion, ambos serializan por fila padre; dos pruebas PostgreSQL de espera y rechazo422 |
| Transacciones | C simulacion y ahora detalles usan manager transaccional para todas sus lecturas/escrituras; creacion atomica de un registro permanece sin cambios |
| Manejo23505 | C crear recupera por numero, detalles comprueban fila existente despues del rollback; simulacion reconoce constraint especifico. Errores diferentes siguen siendo errores, sin fingir exito |
| Limpieza | C numeros IT aleatorios registrados antes de escribir; DELETE parametrizado solo de esos numeros, FK CASCADE limpia detalles; consulta posterior encontro0 filas IT. No se usa TRUNCATE, dropSchema ni reset de catalogos/secuencias |
| Limites | NV escritores SQL externos pueden vulnerar semantica est_id/timestamp (SQL no impone toda la maquina de estados); DE existencia/total/moneda real de orden; no se contacto Order |

## Dependencias

Ejecutado `npm audit --json` y `npm audit --omit=dev --json`; evidencias guardadas en esta carpeta. Total cinco **paquetes afectados**, no cinco avisos: 2 altos, 1 moderado, 2 bajos, 0 criticos. Produccion omit-dev: **0 vulnerabilidades reportadas** (no garantiza ausencia de defectos).

| Paquete instalado / origen | Severidad npm | Impacto probable / recomendacion |
|---|---|---|
| tmp0.0.33 via mau->inquirer->external-editor | Alta (tambien aviso bajo) | Escritura temporal fuera de directorio y symlinks si entradas/rutas locales son controladas por atacante. Herramienta de desarrollo, no dependencia runtime; priorizar resolver antes de usar CLI en entornos compartidos |
| undici6.20.1 via mau | Alta (varios avisos altos/moderados/bajos) | DoS WebSocket/EventSource/TLS, problemas HTTP/cookies e insuficiente aleatoriedad; bypass de validacion TLS en condiciones indicadas por aviso. Riesgo al usar CLI contra servidores no confiables; no se encontro importacion runtime de mau/undici en Payment |
| @nestjs/mau0.2.9 (directa dev) | Moderada heredada | Herramienta del script deploy, no usada por API. Evaluar retirarla si no se usa o cambiar por version probada con transitivas corregidas, con aprobacion |
| inquirer8.2.6 | Baja heredada | Arrastra external-editor/tmp; actualizacion compatible o sustitucion revisada del padre |
| external-editor3.1.0 | Baja heredada | Arrastra tmp; revisar correccion transitiva y compatibilidad |

El audit propone cambiar mau a0.0.6 y marca isSemVerMajor=true: no se aplico ese downgrade ni npm audit fix --force. Evaluar una resolucion compatible/override solo tras comprobar APIs y repetir auditoria; para los avisos actuales tmp debe quedar fuera de <0.2.6 y undici fuera de los rangos vulnerables reportados (incluido <6.29.1), sin asumir que eso baste para avisos futuros. Los enlaces y todos los avisos estan en `dependency-audit.json`, por ejemplo GHSA-ph9p-34f9-6g65 y GHSA-2m5v-pch6-74hx. No se ejecuto deploy ni cambiaron package-lock/dependencias. Mantener separado build/test de instalacion runtime omit-dev.

## Pruebas y reproduccion

En PowerShell se uso npm.cmd para evitar la politica que bloquea npm.ps1, sin cambiar politicas del equipo. Se inicio unicamente el Compose de pruebas existente (`npm run db:test:up`), contenedor ms_payment_postgres_test y volumen aislado; el contenedor de desarrollo no se modifico. Las restricciones iniciales de Docker/red requirieron ejecucion autorizada fuera del sandbox; las consultas de prueba funcionaron con el destino aislado.

| Comando | Resultado final |
|---|---|
| npm run build | Aprobado |
| npm run lint | Aprobado |
| npm test | 110 aprobadas, 16 archivos |
| npm run test:e2e | 11 aprobadas, PostgreSQL aislado |
| npm run test:integration | 25 aprobadas, PostgreSQL aislado |
| npm audit --json | exit1 por vulnerabilidades; 5 paquetes afectados |
| npm audit --omit=dev --json | exit0; 0 reportadas |

La linea base de94 unitarias paso antes de cambios. Nuevas unitarias:12 casos BigId/auditoria (incluye limites generados) y4 filtro. Integracion21->25: dos carreras detalle/finalizacion y dos duplicados tras finalizacion. E2e11 se conserva con destino seguro. Una primera version del test de espera consultaba estadisticas dentro de la transaccion y fallo por snapshot de estadisticas; se corrigio a consulta separada, sin cambiar la logica del servicio. No se omiten esos fallos iniciales ni se presentan como defectos del producto.

Reproducir desde ms_payment: preparar `.env.test.local` conforme al ejemplo con credenciales locales, `npm run db:test:up`, luego los cinco comandos solicitados. Los checks de destino rechazan overrides heredados hacia otra base antes de conectar las suites. Para detener pruebas posteriormente, `npm run db:test:down` conserva volumen (sin -v). El contenedor de pruebas se deja disponible para revision.

## Archivos modificados y justificacion

- `src/common/api-exception.filter.ts` (nuevo), `src/app.module.ts`: Error contractual uniforme y saneamiento de errores inesperados.
- `src/common/api-exception.filter.spec.ts` (nuevo): regresion de formato y no exposicion SQL/parametros.
- `src/pago_tarjeta/pago_tarjeta.service.ts`, `src/pago_transferencia/pago_transferencia.service.ts`: transacciones/bloqueo padre y prioridad409 para detalle existente.
- Sus dos `.service.spec.ts`: adaptar dobles al manager transaccional y lectura previa de bloqueo, conservando casos de negocio.
- `test/payment.integration-spec.ts`: cuatro casos nuevos de regresion; formato del archivo con Prettier.
- `test/app.e2e-spec.ts`, `package.json`: ejecutar e2e con entorno aislado, checks previos y pruebas de bloqueo sin conectar desarrollo.
- `src/common/pipes/bigint-id.audit.spec.ts` (nuevo): caracterizar validacion vigente y candidato separado, sin modificar pipe/DTO publicos.
- `README.md`: enlace a auditoria y aclaracion de ejecucion aislada de ambas suites.
- `docs/auditoria-fase-2.5.md` (este informe), `docs/bigid-proposed-pattern.txt`, `docs/dependency-audit.json`, `docs/dependency-audit-production.json`: propuesta y evidencia sin secretos.

## Decisiones que requieren aprobacion

1. Aprobar correccion coordinada de BigId en contrato, constante compartida, DTOs y pipe. No aplicada.
2. Identificar responsable/proveedor de identidad y aprobar iss, aud, algoritmo, JWKS/claves y rotacion, claims/tipo de access token, exp/nbf, tolerancia, revocacion y principal/tenant. No generar emisor ni claves productivas.
3. Aprobar modelo de permisos general y concesion exacta payment:simulate; definir identidad local verificable para futuras pruebas de guards.
4. Resolver 401 y formato Error Payment versus ProblemDetails general antes de integrar JWT; no modificar contrato ahora.
5. Resolver precedencia del enum metodo_codigo frente a422 por metodo desconocido; definir limite de offset para evitar conversiones no seguras. No endurecidos en esta fase.
6. Definir prohibicion total de produccion/red de la API simulada, incluida lectura y detalles, ademas del bloqueo actual de finalizacion. No declarar este servicio protegido solo por flags.
7. Aprobar estrategia de saneamiento de dependencias de despliegue (mau/transitivas), sin actualizacion mayor/downgrade forzado automatico.

Pendientes tecnicos de verificacion: ampliar pruebas PostgreSQL de filtros/orden/total, privilegios/TLS/rotacion del despliegue real y politicas de datos libres/logs externos. La integracion ms_order queda fuera de alcance: orden_validacion continua NO_VALIDADA y no se hacen cobros reales.
