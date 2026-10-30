# Fase 2.8.1 — Preparación técnica interna de seguridad

Fecha: 2026-10-27, America/Guayaquil. **Autenticación y autorización HTTP todavía NO activas.** Los doce endpoints conservan su comportamiento sin JWT. La preparación interna no es una barrera de seguridad ni una integración con Identity/Order. Fase 2.8.2 no se inicia automáticamente.

## 1. Objetivo y alcance autorizado

Preparar modelos mínimos, puertos de verificación/políticas, evaluación exacta de permisos y fixtures criptográficas locales, sin proveedor de identidad operativo. Se revisaron los informes2.5/2.6/2.7, OpenAPI Payment, estructura src/test, AppModule, filtro, validación de entorno, package/lock, Vitest y aislamiento PostgreSQL. No se encontraron componentes de seguridad reutilizables adicionales.

`jose` no está declarada como dependencia directa ni se encontró en el lock inspeccionado. No se instaló ni utilizó una dependencia transitiva como API. El harness pudo implementarse con primitivas nativas Node24 exclusivamente en tests; no quedó bloqueado por paquetes. Su algoritmo RS256 es de fixture, no una aprobación de producción.

Solo se añadieron `src/security/`, `test/security/` y este informe. No se modificó ningún archivo previo: sin AuthModule, guards, providers globales, cambios de AppModule, controllers, servicios, filtros, entorno, OpenAPI, package/lock, SQL ni modelo de datos. No se añadieron endpoints login/JWKS, llamadas a Identity/Order ni conexiones de desarrollo.

## 2. Arquitectura interna y archivos

```text
src/security/
  principal/authenticated-principal.ts
  jwt/jwt-verifier.port.ts
  jwt/verified-access-token.ts
  permissions/payment-permissions.ts
  permissions/permissions-evaluator.ts
  policy/payment-resource.ts
  policy/resource-policy.port.ts
  policy/resource-policy-evaluator.ts
  index.ts
  ... pruebas .spec.ts junto a los componentes
test/security/
  support/security-test-types.ts
  support/rs256-fixture.ts
  rs256-fixture.spec.ts
docs/fase-2.8.1-preparacion-seguridad.md
```

| Archivos creados | Responsabilidad |
|---|---|
| principal/authenticated-principal.ts | Interfaz mínima y snapshot inmutable, sin autenticar ni mapear claims |
| jwt/jwt-verifier.port.ts | Entrada y tres resultados conceptuales del futuro verificador; sin implementación |
| jwt/verified-access-token.ts | Resultado conceptual mínimo de una verificación futura |
| permissions/payment-permissions.ts | Catálogo congelado de nombres; no concesiones |
| permissions/permissions-evaluator.ts | Comparación pura, exacta, exige todos y deniega lista vacía |
| policy/payment-resource.ts | Recursos Payment/Order, constructores congelados y validación BigId reutilizada |
| policy/resource-policy.port.ts | Solicitud y decisiones explícitas de política; sin adaptador |
| policy/resource-policy-evaluator.ts | Composición defensiva de permiso/formato/decisión; no ownership local inventado |
| index.ts | API interna; no exporta fixtures ni verifier concreto |
| principal/authenticated-principal.spec.ts | Inmutabilidad real, snapshot de Set, ausencia de credenciales y propiedad |
| permissions/permissions-evaluator.spec.ts | Exactitud, mayúsculas, todos los permisos, default deny, roles/wildcards ignorados |
| jwt/jwt-verifier.port.spec.ts | Discriminantes conceptuales con doble explícito y ausencia de verifier exportado |
| policy/resource-policy.spec.ts | Permitir explícito, denegar, indisponibilidad, ausencia de política/alcance y BigId inválido |
| test/security/support/security-test-types.ts | Tipos de fixtures, fuera del build productivo |
| test/security/support/rs256-fixture.ts | Firmante efímero y JWKS en memoria, sin verificador |
| test/security/rs256-fixture.spec.ts | Verificación criptográfica independiente y límites del harness |
| Este informe | Alcance, resultados, limitaciones y gates de Fase2.8.2 |

Las rutas de la tabla son relativas a `src/security/`, salvo donde se indica `test/`. Se añadieron17 archivos en total. Los tests aprovechan el include existente `**/*.spec.ts`; no requieren cambiar scripts o Vitest. Los tipos de testing se ubicaron en test/, en lugar de src/security/testing/, para excluir el harness del build. Los nuevos modelos/evaluadores de src sí se compilan, pero no están importados por la aplicación.

## 3. AuthenticatedPrincipal

Interfaz readonly: issuer, subject, clientId, kind USER/SERVICE, permissions ReadonlySet<string> y expiresAt en **segundos Unix**. Subject es opaco, no usu_id ni ord_id. No hay tenant, propietario, credencial JWT, Authorization, payload libre, contraseñas, claves privadas o datos bancarios.

`createAuthenticatedPrincipal` copia solo esos campos y devuelve un objeto congelado. Crea un snapshot de permisos deduplicado con una vista ReadonlySet sin add/delete/clear. No congela simplemente un Set mutable: el Set real queda privado en un closure, los iteradores solo devuelven strings y forEach recibe la vista inmutable, no el Set interno. Modificar el Set de entrada después no cambia permisos del principal.

**La factoría NO verifica identidad, expiración, claims ni firma.** No transforma JWT en principal; recibe atributos conceptualmente ya comprobados. Un objeto construido manualmente puede tener esa forma y no constituye autenticación. TypeScript y Object.freeze no prueban procedencia criptográfica. El futuro límite de confianza debe ser el verificador real y el adaptador de perfil, no la existencia de este objeto.

## 4. Puerto JWT y VerifiedAccessToken

`JwtVerifierPort.verify(credential: BearerCredential): Promise<JwtVerificationResult>` define una entrada explícita `{ compactToken: string }`: credencial ya extraída, sin el prefijo Bearer. No se implementa extracción HTTP en esta fase. La credencial es entrada sensible; no se copia a principal, salida o errores.

Resultados mutuamente distinguibles:

| status | Significado |
|---|---|
| VERIFIED + token | Futuro adaptador verificó firma asimétrica y todos los atributos/perfil contra confianza configurada independientemente |
| INVALID_CREDENTIAL | Credencial no utilizable o inválida; sin motivo sensible/payload |
| VERIFICATION_UNAVAILABLE | Dependencia necesaria indisponible; no equivale a verificación exitosa |

Son resultados de dominio, sin asignar códigos HTTP ni alterar Error/OpenAPI. No hay clase/verificador concreto, fetch de JWKS, decode para autenticar, selección de issuer desde el token ni implementación que acepte credenciales. Las pruebas del puerto usan un mock de una sola llamada por resultado y declaran expresamente que no autentica; no son pruebas criptográficas.

`VerifiedAccessToken` contiene únicamente atributos internos readonly: issuer, subject, clientId, audiences, expiresAt en segundos y permissionNames como ReadonlySet<string>. No contiene payload/token/roles/tenant/propiedad. Estos nombres no fijan las claves JSON del proveedor. permissionNames representa lo que un **futuro adaptador de perfil aprobado** obtendría de una única fuente verificada, sin mezclar scope/permissions/roles. No hay tal conversión implementada.

El token verificado no es un principal autorizado: no tiene kind ni atribución de propiedad, y comprobar firma nunca concede acceso por sí mismo. La clasificación USER/SERVICE, el perfil, issuer/audience, propósito, algoritmo y concesiones reales siguen pendientes. El contrato readonly de la salida no sustituye la obligación del futuro adaptador de producir snapshots confiables.

## 5. Catálogo y evaluador de permisos

`PAYMENT_PERMISSIONS` está congelado y contiene:

- payment:read, payment:create y payment:detail:create: **nombres propuestos, no aprobados como reglas HTTP**.
- payment:simulate: nombre ya declarado en OpenAPI Payment, todavía sin enforcement JWT.

`hasAllPaymentPermissions(principal, required)` es puro: requiere principal, lista no vacía y **todos** los permisos. Solo reconoce nombres del catálogo y usa coincidencia exacta, sensible a mayúsculas, sin trim, prefijos, wildcard, jerarquías o roles. Requisitos desconocidos, vacíos o ausentes deniegan. Permisos adicionales no conceden acciones distintas. No consulta body/query/headers, JWT, base de datos, reloj ni propiedad.

La función presupone un principal previamente verificado: no es un guard ni vuelve a validar vigencia. Está disponible internamente, sin ser llamada por los endpoints. Que un objeto manual pase una comparación de permisos no demuestra que esté autenticado.

## 6. Recursos y autorización por recurso

`PaymentResource` es una unión: `{ kind: PAYMENT, paymentId: string }` o `{ kind: ORDER, orderId: string }`. Constructores paymentResource/orderResource reciben unknown, reutilizan `isBigIntId` y conservan la cadena exacta; rechazan números, cero, ceros iniciales o fuera de rango con TypeError estático sin reflejar el valor. No hay Number, usuario/tenant, persistencia ni ownership añadido.

`ResourcePolicyRequest` exige principal, action del catálogo y recurso. `ResourcePolicyPort.evaluate` define ALLOW, DENY con razón explícita o POLICY_UNAVAILABLE. Su contrato exige que un ALLOW de un futuro adaptador confiable se vincule a **ese principal, acción y recurso** y a un alcance autoritativo. Un permiso válido o un ord_id nunca prueban propiedad.

`evaluatePaymentResourceAccess` es una composición interna, no un servicio Nest ni política de ownership:

1. Revalida el recurso aun si el llamador lo construyó manualmente: inválido → DENY/INVALID_RESOURCE.
2. Permiso insuficiente → DENY/MISSING_PERMISSION sin consultar política.
3. Sin política → DENY/POLICY_NOT_CONFIGURED, aunque el permiso sea válido.
4. Una decisión ausente/desconocida → DENY/NO_TRUSTED_DECISION.
5. Excepción del adaptador → POLICY_UNAVAILABLE sin propagar detalles; nunca allow por error.
6. Conserva decisiones explícitas ALLOW/DENY/POLICY_UNAVAILABLE del puerto.

NO_TRUSTED_SCOPE y RESOURCE_ACCESS_DENIED permiten expresar ausencia de alcance y acceso ajeno. No hay adaptador de producción ni uno que permita todo. El ALLOW de las pruebas es un resultado controlado del doble, no una implementación de propiedad. El puerto es una frontera de confianza futura: no puede aceptar una decisión aportada por el cliente HTTP. La futura implementación debe comprobar fuente, vigencia y vinculación de cada decisión; este código no inventa esos atributos.

## 7. Harness criptográfico y JWKS local

Se implementó en `test/security/`, excluido por tsconfig.build.json. Usa `node:crypto.generateKeyPair` asíncrono con RSA2048, KeyObject, SHA256 y padding RSA_PKCS1_PADDING para **RS256 de fixture**. La serialización compacta es JSON/base64url; las operaciones criptográficas son primitivas Node/OpenSSL, no algoritmos propios. Node documenta generación, firma/verificación y exportación JWK en su [API Crypto24](https://nodejs.org/docs/latest-v24.x/api/crypto.html).

La clave privada nunca se exporta ni sale del closure. No hay filesystem, red, subprocess, variables de entorno, credenciales reales o tokens persistidos en el helper. `sign` recibe claims controlados y permite cambiar typ/kid para negativos; alg permanece RS256. Las pruebas incluyen tokens con tiempos vigentes y también expiración/audiencia/sujeto/tipo deliberadamente incorrectos.

`getJwks()` es el proveedor **en memoria**: devuelve snapshots congelados con solo kty/n/e/alg/use/kid, nunca d/p/q/dp/dq/qi. No se necesita HTTP: no hay listeners, puertos, endpoints nuevos o JWKS de pruebas en AppModule. Se comprobó que el build no contiene rs256-fixture ni security-test-types.

`rotate()` genera nueva clave efímera, publica la pública y cambia el firmante; conserva solo las públicas previas para probar solapamiento. `retire(kid)` retira una pública anterior y rechaza retirar la activa. No simula una red/caché/rotación productiva ni prueba un SLA de prepublicación. Retirar una clave del JWKS no destruye copias públicas ni invalida matemáticamente las firmas: esa política sigue pendiente para el verificador futuro.

`dispose()` vacía públicas y libera referencias privadas, y bloquea firma/rotación posteriores; se invoca al terminar las suites. No se promete borrado físico inmediato/zeroization en memoria de JavaScript/OpenSSL. No se guardan tokens o claves privadas en snapshots, logs o archivos.

**No hay un verificador JWT en el harness.** La prueba utiliza WebCrypto.subtle, API independiente del firmante nativo, para importar la pública JWK y comprobar únicamente la firma. Un JWT con claims inválidos puede tener firma correcta: las pruebas lo muestran deliberadamente. Eso no produce VERIFIED, principal ni autorización; tampoco equivale a verificar un access token productivo. Los tokens generados solo son fixtures para futuras pruebas aprobadas.

## 8. Pruebas ejecutadas

| Nuevas pruebas unitarias | Casos |
|---|---:|
| Principal y snapshot inmutable, campos mínimos, USER/SERVICE | 4 |
| Permisos exactos, múltiples/parciales, vacío/ausente, case, wildcard, roles y fuentes HTTP ignoradas | 19 |
| Contrato JWT y ausencia de verificador concreto exportado | 2 |
| Política explícita, falta de alcance/política, errores, decisión desconocida, BigId y permisos insuficientes | 17 |
| Harness RSA/JWKS, firma independiente, alteraciones, clave equivocada, kid, claims negativos, rotación, dispose y separación productiva | 9 |
| **Total nuevo** | **51** |

Regresión solicitada, ejecutada con npm.cmd en PowerShell sin cambiar políticas:

| Comando | Resultado |
|---|---|
| npm run build | Aprobado |
| npm run lint | Aprobado |
| npm test | **193 aprobadas**,21 archivos |
| npm run test:e2e | **11 aprobadas**,1 archivo |
| npm run test:integration | **54 aprobadas**,1 archivo |
| **Total** | **258 aprobadas** (207 previas +51 nuevas) |

No se cambió ninguna suite anterior. E2e/integración siguen invocando los doce endpoints sin JWT y comprueban los comportamientos previos, incluidos BigId, idempotencia, detalles, simulación y concurrencia. No hay nuevos errores HTTP de seguridad, códigos de estado ni metadatos de permisos en rutas.

Chequeos adicionales: compilación estricta TypeScript de **todos los archivos nuevos**, incluidos tests/helpers, aprobada con configuración temporal en .tmp. `tsc --noEmit --incremental false` global, no parte de los cinco scripts anteriores, detectó **9 errores preexistentes** en tests sin modificar: cinco tipados de driverError.code en QueryFailedError (api-exception.filter y servicios) y cuatro usos de dataSource posiblemente undefined en payment.integration-spec.ts. No se ocultaron ni corrigieron incidentalmente: no hay errores nuevos en src/security/test/security tras el chequeo acotado. Build productivo, lint y las258 pruebas sí pasan. Estos errores globales de tipado son un pendiente separado, no una falla criptográfica ni de HTTP.

## 9. Evidencia de aislamiento y ausencia de conexión a la aplicación

Las suites HTTP cargaron configuración existente con NODE_ENV=test, DB_HOST127.0.0.1, DB_PORT5434 y DB_DATABASE ms_payment_test. Las comprobaciones antes de conectar y del DataSource continúan intactas; synchronize/dropSchema/migrationsRun=false. No se consultó ni modificó desarrollo. El harness no necesita PostgreSQL.

Cleanup de integración conservó DELETE parametrizado de números propios, RETURNING y comprobación de0 pagos propios,0 tarjetas y0 transferencias. Una consulta posterior independiente, con guard de destino aislado, devolvió database=ms_payment_test y **remaining_integration_rows=0**. No hubo DDL, cambios de secuencias ni borrados globales.

La comparación SHA256 de94 archivos previos registrados antes/después confirma que no cambió ninguno: src/test existentes, AppModule, filtro, entorno y ejemplos, package/lock, contrato Payment/general y SQL oficial/inicializadores incluidos. Los artefactos habituales de build/.tmp no forman parte de esa comparación y están ignorados. Los cambios previos ya presentes en el árbol de Git no se atribuyen a Fase2.8.1.

No hay import de los componentes nuevos en la aplicación existente, ni de fixtures en src. El barrel de seguridad no registra providers. No se activaron guards, no hay AuthModule ni puerto/provider DI por defecto. La mera compilación de src/security no habilita protección HTTP.

## 10. Riesgos pendientes y dependencias de Fase 2.8.2

- Aprobar proveedor real y contrato operativo de Identity, issuer/audience exactos, algoritmo, tipo de access token, JWKS, rotación, timeouts, caché, vigencia y revocación. RS256 de fixture no decide producción.
- Aprobar formato canónico de permisos, clasificación USER/SERVICE y transformación de atributos ya verificados; los tres nombres nuevos no son concesiones aprobadas.
- Resolver fuente autoritativa de propiedad/alcance y relación entre iss/sub y usuario. No existe acceso seguro a pagos ajenos por conocer ord_id, tener scope o una identidad de servicio.
- Aprobar contratos/códigos HTTP401/403/503, desafíos Bearer y transición de clientes antes de registrar guards o cambiar rutas. No existe mapeo de resultados de dominio a HTTP en esta fase.
- Elegir y autorizar una biblioteca de verificación productiva mantenida. No reutilizar signatureMatches de las pruebas como un verificador JWT; faltan propósito, claims, confianza, claves y política completa.
- El puerto de políticas necesita un adaptador real con decisiones vinculadas al recurso y manejo de indisponibilidad; no permitir globalmente si falta. La integración Order sigue sin autorización y no se implementa por tener este puerto.
- Resolver por separado los nueve errores de tipado preexistentes si se incorpora un chequeo global de TypeScript de tests al pipeline.
- Revisar TLS/red/secretos/despliegue antes de exponer la futura solución. La seguridad HTTP actual sigue ausente; simulación mantiene default false y bloqueo de producción.

Preparación completada dentro del alcance. **Detener para revisión antes de Fase2.8.2; no hay autenticación activa.**
