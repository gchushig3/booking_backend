# Fase 2.6 — Corrección de BigId y alineación OpenAPI

Fecha: 2026-10-27, America/Guayaquil. **Completada**, limitada a la autorización de corregir identificadores. Dominio: cadenas decimales canónicas que representan enteros entre **1 y 9223372036854775807**, ambos incluidos. No se avanzó a otra fase.

## Contrato fuente y alcance

El contrato canónico para Payment en este checkout es [`contract/ms_payment-openapi-v1.yaml`](../contract/ms_payment-openapi-v1.yaml). Es el único OpenAPI específico de este servicio encontrado en el árbol del proyecto. La implementación Nest no carga un YAML para validar en runtime ni genera DTOs desde él: usa pipes y class-validator. Las nuevas pruebas leen directamente ese archivo canónico para detectar divergencias.

`../../contracts/atracciones-openapi-v3.yaml` es otro contrato, de Atracciones, no una copia de Payment; no se modifica ni requiere sincronizar este BigId. No se encontraron otras copias de OpenAPI Payment. Las diez referencias `$ref` a BigId dentro del contrato Payment reciben la corrección desde el único esquema: filtro ord_id, parámetro BigPathId, CrearPago.orden_id, Pago.id/orden_id y los IDs de ambos detalles. Los controladores usan BigIntIdPipe para todas las rutas correspondientes.

Se revisaron la auditoría 2.5, su patrón propuesto, el contrato, DTOs, pipe, validación global, pruebas unitarias/e2e/integración y referencias de versionado del flujo de trabajo. No hay un procedimiento específico de incremento de versión para este cambio; se mantiene `info.version: 1.1.0`, OpenAPI3.0.3 y la declaración **propuesto/no oficial**, conforme al alcance autorizado. El único cambio del YAML es dentro de `components.schemas.BigId`: patrón corregido y `minLength: 1`; type string, maxLength19, descripción y ejemplo se conservan. No cambian rutas, estados HTTP ni respuestas.

## Archivos creados y modificados en esta fase

| Archivo | Cambio |
|---|---|
| `contract/ms_payment-openapi-v1.yaml` | Modificado exclusivamente BigId |
| `src/common/validation/bigint-id.validation.ts` | Nuevo: máximo central, predicado y decorador reutilizable |
| `src/common/pipes/bigint-id.pipe.ts` | Usa predicado común, recibe unknown y conserva 400 INVALID_ID / string |
| `src/pago/dto/crear-pago-request.dto.ts` | orden_id utiliza IsBigIntId; las demás reglas permanecen |
| `src/pago/dto/listar-pagos-query.dto.ts` | ord_id utiliza IsBigIntId y omisión solo con undefined |
| `src/common/pipes/bigint-id.audit.spec.ts` | Actualizada auditoría histórica a equivalencia de comportamiento corregido, leyendo el patrón del contrato real |
| `src/pago/pago.service.spec.ts` | Tres fixtures controlados de IDs de pago de19 dígitos, sin escrituras |
| `test/payment.integration-spec.ts` | 29 casos adicionales HTTP/PostgreSQL y comprobación de limpieza de las filas propias y sus detalles |
| `README.md` | Enlace a resultados de esta fase |
| `docs/fase-2.6-bigid.md` | Este informe |
| `docs/fase-2.6-evidencia.json` | Evidencia de pruebas, aislamiento, limpieza, hashes y alcance del cambio contractual |

El árbol de trabajo ya contenía los cambios de Fase2.5 al iniciar. No se revirtieron ni se atribuyen a esta fase. `docs/auditoria-fase-2.5.md` se conserva como informe histórico: sus menciones de BigId pendiente describen el estado anterior. `docs/bigid-proposed-pattern.txt` no se modifica: su patrón es ahora el incorporado al contrato.

## Patrón definitivo

```regex
^(?:[1-9][0-9]{0,17}|[1-8][0-9]{18}|9[0-1][0-9]{17}|92[0-1][0-9]{16}|922[0-2][0-9]{15}|9223[0-2][0-9]{14}|92233[0-6][0-9]{13}|922337[0-1][0-9]{12}|92233720[0-2][0-9]{10}|922337203[0-5][0-9]{9}|9223372036[0-7][0-9]{8}|92233720368[0-4][0-9]{7}|922337203685[0-3][0-9]{6}|9223372036854[0-6][0-9]{5}|92233720368547[0-6][0-9]{4}|922337203685477[0-4][0-9]{3}|9223372036854775[0-7][0-9]{2}|922337203685477580[0-6]|9223372036854775807)$
```

Es exactamente el patrón propuesto en Fase2.5, contrastado automáticamente con comparación BigInt antes de su incorporación y posteriormente con el corpus ampliado. El test también exige igualdad entre el patrón leído del YAML y el archivo de propuesta, sin mantener una tercera expresión compleja en el código productivo.

Su equivalencia se explica por partición del dominio: la primera alternativa cubre enteros canónicos de1 a18 dígitos. Para19 dígitos, cada alternativa restante cubre un prefijo igual al máximo seguido de un dígito menor y cualquier sufijo decimal de la longitud restante; la última cubre el máximo exacto. Todo valor de19 dígitos menor que el máximo tiene un primer dígito diferente que es menor, por lo que pertenece a una de esas alternativas. Ninguno mayor puede pertenecer a ellas. Sin ceros iniciales, signos, decimales, espacios ni notación exponencial.

## Utilidad común, pipe y DTOs

`POSTGRES_BIGINT_ID_MAX = 9223372036854775807n` centraliza el máximo. `isBigIntId(value: unknown): value is string` comprueba tipo string, sintaxis `/^[1-9][0-9]{0,18}$/` y comparación exacta `BigInt(value) <= POSTGRES_BIGINT_ID_MAX`. La sintaxis garantiza mínimo1, máximo19 dígitos y que la conversión BigInt sea segura; nunca convierte el identificador a Number. No recorta, rellena ni transforma la cadena.

`IsBigIntId()` registra una restricción reutilizable de class-validator con mensaje de rango y formato, sin reflejar el valor. BigIntIdPipe usa el mismo predicado y mantiene exactamente el error400 con `code: INVALID_ID`; devuelve la cadena original. CrearPagoRequestDto.orden_id y ListarPagosQueryDto.ord_id usan el decorador común.

El filtro ord_id sigue siendo opcional si se omite (undefined). Se sustituye IsOptional únicamente en ese campo por ValidateIf(value !== undefined), porque IsOptional omite también null: null explícito no pertenece al dominio BigId autorizado. Los filtros estado/metodo y la paginación no cambian. No se introducen conversiones implícitas.

## Equivalencia y casos límite

Las pruebas comparan el **esquema real** (type, minLength, maxLength y RegExp leída del YAML), la utilidad, el pipe y ambos DTOs contra un oráculo independiente. El oráculo comprueba cada carácter decimal, primer dígito distinto de0, longitud y rango con BigInt; no usa la utilidad, su constante ni su regex. Para el DTO de listado se distingue la ausencia válida del filtro de un ID proporcionado inválido.

Se ejecutan **39 casos explícitos de frontera y tipo**, además de **3421 cadenas generadas distintas**. El corpus determinista incluye todos los primeros dígitos divergentes respecto del máximo en19 posiciones, sufijos extremos0/9 y vecinos ±1; 1024 iteraciones con aritmética BigInt de64 bits; valores dentro del rango y de distintas longitudes; y variantes con ceros/signos/espacios/decimales/exponentes. No se basa solo en ejemplos ni afirma enumerar los9,22×10^18 identificadores posibles: combina la partición anterior con pruebas de fronteras y generación reproducible.

| Casos explícitos | Resultado |
|---|---|
| 1, 42 | Aceptados sin transformación |
| 9007199254740993 | Aceptado exactamente, mayor que MAX_SAFE_INTEGER |
| 9199999999999999999, 9200000000000000000, 9220000000000000000 | Aceptados |
| 9223372036854775800, 9223372036854775806, 9223372036854775807 | Aceptados |
| 9223372036854775808, 9999999999999999999 | Rechazados |
| 10000000000000000000 y cadenas generadas de más de19 dígitos | Rechazados |
| 0, -1, 01, +1, 1.0, 1e3, abc, vacío | Rechazados |
| Espacios, saltos de línea, CRLF, tabulador, NUL, separadores Unicode y dígitos de ancho completo | Rechazados |
| Number JSON, null, boolean, bigint JS, NaN, Infinity, objeto y array | Rechazados por validación BigId |
| undefined | Inválido como ID requerido; permitido solo como filtro omitido |

## HTTP y PostgreSQL

Todas las pruebas HTTP reales conectaron exclusivamente a `NODE_ENV=test`, `127.0.0.1:5434/ms_payment_test`. La suite comprueba esas variables antes de crear Nest y después verifica opciones del DataSource y current_database(). PostgreSQL observado:17.11.

| Verificación | Resultado |
|---|---|
| POST pagos con orden_id 9200000000000000000 y máximo9223372036854775807 | 201; respuesta con string exacto |
| POST con los otros cinco IDs válidos de la tabla anterior | 201; string exacto |
| GET pagos filtrando por cada uno de los siete IDs de orden | 200; incluye el intento creado y todos los items tienen el orden_id solicitado |
| GET pago recién creado | 200; ID y orden_id conservados |
| SELECT ord_id::text del registro insertado | Coincide exactamente con el valor enviado en los siete casos |
| GET pagos/{id} para9199999999999999999,9200000000000000000,9220000000000000000 y máximo | 404 NOT_FOUND, nunca400 INVALID_ID: ID aceptado y consulta real sin recurso existente |
| Fuera de rango, negativos, ceros iniciales, signos, decimales, exponentes, letras y espacios | 400 en body/query/path; INVALID_REQUEST o INVALID_ID según validación |
| Body orden_id null, Number JSON, boolean o vacío | 400 y cero filas insertadas para el intento |

Para IDs **de pago** de19 dígitos no se forzaron secuencias ni se insertaron identidades manuales. Como alternativa segura autorizada, tres fixtures unitarios del servicio hacen que el repositorio devuelva una entidad con pagId/ordId de19 dígitos y comprueban que obtenerPorId recibe/consulta/devuelve exactamente las cadenas. Esto verifica el mapeo de éxito sin afirmar que exista un pago real con ese ID en PostgreSQL. El camino HTTP real de IDs válidos de19 dígitos se comprueba mediante404. La persistencia PostgreSQL de strings grandes se comprueba con ord_id, que no es identidad generada.

## Regresión integral

| Comando | Resultado |
|---|---|
| npm run build | Aprobado |
| npm run lint | Aprobado |
| npm test | **142 aprobadas**,16 archivos |
| npm run test:e2e | **11 aprobadas**,1 archivo |
| npm run test:integration | **54 aprobadas**,1 archivo |

Se usó npm.cmd en PowerShell sin cambiar la política de ejecución. No se instalaron/actualizaron dependencias. La base anterior era110/11/25: se sustituyen12 casos de auditoría por41 casos de equivalencia y se añaden3 casos de mapeo (142 unitarias); se agregan29 casos HTTP/integración (54). Todas las pruebas previas de negocio se conservan: cuatro operaciones de catálogos, creación, idempotencia, listado/filtros, consulta, ambos detalles, simulación, errores y carreras concurrentes. La configuración e2e permanece igual a Fase2.5.

## Aislamiento, limpieza y límites

La limpieza elimina solo pagos cuyos números aleatorios fueron registrados por esta ejecución; conserva el DELETE parametrizado y usa RETURNING para verificar que los detalles de esos IDs desaparecieron por CASCADE. Las aserciones finales comprueban0 pagos propios,0 tarjetas y0 transferencias. Una consulta posterior independiente, restringida al destino aislado, encontró **0 filas IT restantes**. No se ejecutaron TRUNCATE, ALTER SEQUENCE, setval, DDL ni borrados globales.

`docs/fase-2.6-evidencia.json` registra hashes SHA256 antes/después: SQL oficial, ambos inicializadores SQL, contrato general Atracciones, package.json/lock y app.module.ts permanecen idénticos al inicio de esta fase. Una comparación del contrato completo excluyendo únicamente el bloque BigId confirma que todo lo demás permanece idéntico. TypeORM continúa con synchronize/dropSchema/migrationsRun=false. No se conectó a la base de desarrollo, no hubo pagos reales ni integración ms_order.

No quedan diferencias de dominio BigId conocidas entre contrato y validación TypeScript. Los casos generados no sustituyen la explicación matemática del rango. Los riesgos de identidad, permisos, dependencias de despliegue y otras decisiones de Fase2.5 siguen pendientes y están fuera de esta autorización; no se implementó JWT ni payment:simulate. Los consumidores que hayan copiado el patrón antiguo fuera de este checkout deberán actualizar su copia del esquema; no se identificaron copias locales adicionales.
