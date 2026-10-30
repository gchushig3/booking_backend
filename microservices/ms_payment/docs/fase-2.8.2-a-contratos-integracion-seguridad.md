# Fase 2.8.2-A — Contratos para integrar autenticación y autorización

Fecha: 2026-10-27, America/Guayaquil. **Análisis para revisión; no autoriza implementación.** JWT y autorización HTTP siguen inactivos. Único archivo creado: este informe. No se modifica código, tests, SQL, OpenAPI, dependencias ni entorno.

## 1. Resumen ejecutivo

**Emisor JWT operativo: BLOQUEADO, no confirmado. Autorización operativa de órdenes: BLOQUEADA, contrato no encontrado. Integración HTTP: BLOQUEADA por ambas decisiones y la transición contractual.**

Payment tiene contratos internos y evaluadores comprobados, pero no verifier criptográfico productivo ni adaptador de políticas. Identity/Order existen como definiciones SQL, no como servicios ejecutables encontrados. Gateway existe como referencia documental, no como infraestructura verificada. No se adoptan URLs, claims o claves de ejemplos/fixtures como configuración real.

Se propone un contrato remoto de decisiones por orden y de enumeración consistente del alcance autorizado. Separa identidad del usuario, identidad del servicio llamador y delegación; restringe filas y conteos antes de paginar. No hay autorización global provisional. La propuesta no crea endpoints/RPC ni autoriza acceder a las bases de otros servicios.

## 2. Alcance de inspección e inventario

Se leyeron [diseño2.7](fase-2.7-diseno-seguridad.md), [preparación2.8.1](fase-2.8.1-preparacion-seguridad.md), [tipado2.8.1.1](fase-2.8.1.1-tipado-typescript.md), [auditoría2.5](auditoria-fase-2.5.md), [OpenAPI Payment](../contract/ms_payment-openapi-v1.yaml), src/security, AppModule, validación de entorno y package. La búsqueda del árbol booking-backend cubrió código, contratos, SQL, configuración y documentación, excluyendo dependencias, Git, artefactos dist y temporales como fuentes de implementación.

Referencias adicionales: [contrato general Atracciones](../../../contracts/atracciones-openapi-v3.yaml), [inventory.proto](../../../contracts/inventory.proto), [SQL oficial](../../02_microservicios_v2_bases_de_datos.sql) y [flujo_trabajo](../../flujo_trabajo.md). README y render.yaml de la raíz están vacíos. Los documentos Plan/... citados por el SQL no se encontraron. No se consultó un despliegue remoto ni bases Identity/Order/desarrollo. Ausencia en este checkout no implica inexistencia en toda la organización.

Leyenda: **EXISTENTE** describe evidencia real, con estado implementado/parcial/documental; **PROPUESTO** describe este diseño; **PENDIENTE** indica información, implementación o aprobación faltante. Una tabla o una URL documentada no prueba servicio desplegado.

| Componente | Ruta real encontrada | Evidencia | Estado | Responsabilidad prevista / dependencia Payment |
|---|---|---|---|---|
| API Payment | microservices/ms_payment/src/ | Módulos, doce operaciones, TypeORM y tests HTTP | EXISTENTE, implementado | Registro/consulta/simulación local |
| Principal y permisos | src/security/principal/, permissions/ | Snapshot readonly y comparación exacta | EXISTENTE, implementado internamente | No autentican ni acreditan propiedad |
| Verificación JWT | src/security/jwt/ | JwtVerifierPort, VerifiedAccessToken; sin implementación | EXISTENTE, parcialmente implementado | Contrato disponible; verifier/productor de identidad PENDIENTES |
| Política de recurso | src/security/policy/ | Puerto, recursos BigId y composición defensiva; sin adaptador | EXISTENTE, parcialmente implementado | No fuente real de alcance/listados |
| Identity | microservices/02_microservicios_v2_bases_de_datos.sql, bloque1 | Base ms_identity y tablas | EXISTENTE, documental | Servicio operativo PENDIENTE |
| Usuarios/roles | Mismo SQL, usuario/rol/usuario_rol y seeds | ADMIN, OPERADOR, CLIENTE | EXISTENTE, documental | No mapping JWT/scopes aprobado |
| Sesiones/revocación | Mismo SQL, sesion | Hash, expiración, revocación | EXISTENTE, documental | No API/introspección ni invalidación distribuida encontrada |
| Login/emisión/OAuth2/OIDC | Ninguna implementación/contrato operativo localizado | No token endpoint, discovery o flujo ejecutable | Ausente en checkout, PENDIENTE | Bloquea proveedor real |
| Claves/JWKS/iss/aud reales | Ninguna configuración localizada | No parámetros JWT productivos ni JWKS de proveedor | Ausente, PENDIENTE | Bloquea confianza del verifier |
| Registro M2M/delegación | Ninguno localizado | cliente_api figura como tabla excluida/no creada en SQL, no como registro operativo | Ausente, PENDIENTE | Bloquea credenciales técnicas y actor delegado |
| Order | SQL oficial, bloque10 | orden.usu_id e índice ix_orden_usu_id | EXISTENTE, documental | Fuente candidata de propiedad, no servicio operativo |
| Autorización/listado de órdenes | Ningún endpoint/RPC localizado | inventory.proto solo modela inventario, no Order | Ausente, PENDIENTE | Bloquea alcance y listado seguro |
| API Gateway | contracts/atracciones-openapi-v3.yaml, servers; inventory.proto | Gateway Booking mencionado, URLs/puertos documentados | EXISTENTE, documental | No routing Payment/JWT/TLS verificables |
| Configuración Gateway/TLS/acceso directo | No implementación encontrada; render.yaml vacío | Sin proxy, rutas Payment o propagación confiable | Ausente en checkout, PENDIENTE | Topología y frontera de confianza por confirmar |
| Bearer/API key generales | Contrato Atracciones, securitySchemes | BearerAuth y ApiKeyAuth | EXISTENTE, documental | API key no está autorizada para Payment |
| Comunicación entre servicios | microservices/flujo_trabajo.md, sección13; inventory.proto | Guía de contratos/timeouts; contrato gRPC de stock | EXISTENTE, documental | No determina identidad/ownership de Order |
| Guards activos/AuthModule | No encontrados en src | AppModule sin providers JWT ni guards | Ausente, PENDIENTE | No protección HTTP activa |
| Harness RSA | test/security/support/rs256-fixture.ts | RS256 efímero, JWKS en memoria | EXISTENTE, implementado solo tests | No IdP, discovery, revocación o perfil productivo |

Las rutas src/, test/ y contract/ de este documento son relativas a ms_payment, salvo prefijo booking-backend explícito. El único servicio ejecutable encontrado en este árbol es Payment. Configuración actual: DB_*, NODE_ENV, SIMULATION_ENABLED y PORT leído en main; no hay issuer/audience/JWKS operativos. No se imprimieron secretos ni copiaron claves privadas.

## 3. Evidencia específica de Identity

SQL oficial: bloque1, `\connect ms_identity`; tablas usuario, rol, usuario_rol, sesion y token_verificacion. usuario usa contraseña bcrypt como intención documental; sesion modela token hash/expiración/revocación; token_verificacion se refiere a EMAIL/RECUPERACION. Ninguna de estas tablas especifica que el token de sesión sea un JWT access token.

No se encontró servicio ejecutable, endpoints de autenticación, emisión, algoritmo, claves públicas, JWKS, issuer, audiencia, perfil de claims o vigencia/rotación operativa. No se encontró registro M2M, token exchange, discovery OAuth/OIDC o contrato de revocación consumible por Payment. Los roles SQL no definen scopes ni el tipo USER/SERVICE de un principal. No asignar ADMIN→payment:simulate.

La responsabilidad emisora debe confirmarse con el responsable de Identity o un proveedor externo autorizado. No se asigna una persona/equipo cuya existencia no esté documentada. Las URLs del contrato general y las URN del harness no constituyen issuer confirmado.

## 4. Evidencia específica de Order

El bloque10 SQL define ms_order (gRPC), orden.ord_id y orden.usu_id como referencia lógica Identity, índice por usuario y vista v_orden_financiero. Define además idempotencia por idem_sujeto/operación. Esos datos explican dónde podría mantenerse propiedad, pero no autorizan a Payment a consultarlos ni permiten identificar JWT sub con usu_id automáticamente.

No se encontró ejecutable Order, proto Order, RPC de propiedad/decisión, listado de órdenes autorizadas, autenticación de llamadores internos o política de timeout/indisponibilidad específica. Las recomendaciones generales de flujo_trabajo no constituyen un contrato remoto. La tabla idempotencia de Order no sustituye la idempotencia actual por pag_numero de Payment.

Por tanto, preguntas de propietario, acceso de usuario, creación de pagos, delegación de servicios, conjunto listado, vigencia de decisiones y respuesta ante caídas permanecen PENDIENTES. La sección10 propone un contrato explícito que permite responderlas sin exponer directamente datos personales del propietario.

## 5. Evidencia específica de Gateway

El contrato general describe API Gateway Booking y canales gRPC stock/REST. inventory.proto menciona tiendas registradas en Gateway; no es un contrato de identidad delegada ni de enrutamiento Payment.

No se encontró servicio ejecutable Gateway, validación JWT implementada, routing `/api/v1/pagos`, propagación segura de principal, protección contra acceso directo o configuración TLS. El contrato declara una URL HTTPS y la describe como producción, pero no se verificó ese despliegue y no se traslada esa afirmación a Payment.

PROPUESTO: si existe Gateway operativo, mantener verificación de token en Payment y cerrar rutas de bypass mediante red/proxy configurados. No confiar en X-User-Id/X-Roles. Acordar delegación si Gateway usa su propia identidad; un token global de Gateway no conserva automáticamente el alcance del usuario. Un Gateway nuevo no es requisito para programar un verifier, y no se crea en esta fase.

## 6. Decisión del emisor: BLOQUEADA

| Dato requerido | Estado real | Evidencia necesaria para desbloquear |
|---|---|---|
| Componente/responsable emisor | PENDIENTE | Servicio operativo autorizado y responsable designado |
| Contrato de emisión/flujos | PENDIENTE | Cliente interactivo/M2M, obtención y renovación |
| Issuer/audience | PENDIENTE | Valores exactos autorizados para Payment y para el autorizador remoto |
| Algoritmo/claves/JWKS | PENDIENTE | Política de firma, públicas y URI de confianza |
| Tipo/claims | PENDIENTE | Access token distinguible de ID token, principal y scopes canónicos |
| Vigencia/rotación/revocación | PENDIENTE | Tiempos, incidentes, caché y SLA documentados |
| Cliente M2M/delegación | PENDIENTE | Registro de Payment y acreditación de usuario/actor |

**No hay proveedor operativo confirmado con la evidencia disponible.** No se inventan issuer/JWKS para desbloquearlo, no se emite identidad desde Payment y no se usarán fixtures como credenciales productivas. Las decisiones del contrato siguiente son PROPUESTAS, no acuerdos ya alcanzados con Identity/Order.

## 7. Perfil de access token: real frente a candidato

Confirmado únicamente: modelos internos readonly, puerto sin verifier, catálogo/evaluación exactos y criptografía de fixtures. No hay parámetros JWT productivos confirmados. La recomendación de propósito explícito, verificación de algoritmo/firma/emisor/audiencia se fundamenta en [RFC8725](https://www.rfc-editor.org/rfc/rfc8725.html); no significa que cualquier JWT firmado sea aceptable.

| Aspecto | PROPUESTO | PENDIENTE de aprobar |
|---|---|---|
| Perfil/tipo | Access token de propósito explícito; candidato RFC9068, typ at+jwt/application/at+jwt | Compatibilidad real del emisor; no aceptar ID token de la misma clave |
| Firma | Un algoritmo asimétrico acordado y clave compatible; rechazar none/HS y algoritmos no permitidos | RS256 o alternativa del proveedor; RS256 fixture no decide producción |
| iss/aud | Coincidencia exacta con confianza configurada, audiencia específica | Valores reales; no derivarlos del header/token o ejemplos |
| exp/nbf/iat | exp obligatorio; nbf validado si existe; iat válido/no futuro y edad máxima | Perfil/obligatoriedad iat, duración candidata300s |
| sub | String opaco; identidad por iss/sub | Vínculo autoritativo con usuario Identity; nunca comparar con ord_id |
| client_id/kind | Cliente validado y clasificación USER/SERVICE confiable | Fuente/mapping autorizado; no inferir por roles/nombre de sub |
| Permisos | Una fuente canónica validada; comparación exacta | Claim scope o adaptador específico; nunca unir automáticamente roles/permissions/scope |
| kid/JWKS | kid no vacío y acotado, clave pública única compatible; URI fija HTTPS | Origen/registro/rotación; no seguir jku/x5u ni kid como URL |
| Caché/timeout | Caché candidata300s, timeout2s, cooldown30s; no stale ilimitado | Límites/SLA; comportamiento ante clave comprometida |
| Reloj | Tolerancia candidata30s, acotada0..60 | Aprobación y sincronización de entornos |
| Revocación | Vida corta y mecanismo/SLA explícitos | Sesion.ses_revocada/jti no revocan JWT offline por sí solos |
| Tenant | No asumirlo ni añadirlo al modelo | Definir solo si arquitectura lo exige |

El perfil candidato [RFC9068](https://www.rfc-editor.org/rfc/rfc9068.html) define claims/tipo de access tokens; no está adoptado por un emisor confirmado. VerifiedAccessToken no representa payload libre: sus campos internos son issuer/subject/clientId/audiences/expiresAt/permissionNames. Falta el adaptador aprobado y la clasificación kind para construir el principal. Construir manualmente AuthenticatedPrincipal nunca autentica.

Con clave conocida y caché vigente puede verificarse durante una caída JWKS sin extender caché ni omitir claims. Sin clave confiable/consulta disponible: indisponibilidad, nunca allow. JWKS obtenido correctamente sin kid o firma inválida: credencial inválida. Proponer503 para la dependencia,401 para token inválido; ambos requieren contrato HTTP. Rotación debe prepublicar clave nueva y acordar solapamiento; retirar una pública no elimina copias cacheadas.

## 8. Matriz de las doce operaciones

Prefijo `/api/v1`. U: usuario con alcance confiable; S: servicio registrado con alcance/delegación aprobados; Q: identidad explícitamente autorizada para simular en entorno de pruebas/desarrollo. Categorías PROPUESTAS, no roles existentes. Todas las reglas HTTP requieren aprobación y siguen inactivas.

| # | Método | Ruta | Permiso candidato | Identidad | Alcance/propiedad | Estado |
|---|---|---|---|---|---|---|
| 1 | GET | /metodos-pago | payment:read | U/S | Catálogo compartido; sin consulta Order | PROPUESTO |
| 2 | GET | /metodos-pago/{id} | payment:read | U/S | Catálogo/SMALLINT; sin Order | PROPUESTO |
| 3 | GET | /estados-pago | payment:read | U/S | Catálogo compartido; sin Order | PROPUESTO |
| 4 | GET | /estados-pago/{id} | payment:read | U/S | Catálogo/SMALLINT; sin Order | PROPUESTO |
| 5 | POST | /pagos | payment:create | U/S | Orden solicitada y persistida antes de devolver reintento | PROPUESTO, requiere fuente externa |
| 6 | GET | /pagos | payment:read | U/S | Conjunto autorizado antes de ordenar/paginar/contar | PROPUESTO, requiere listado de alcance |
| 7 | GET | /pagos/{id} | payment:read | U/S | Resolver pago→orden y autorizarla | PROPUESTO, requiere fuente externa |
| 8 | POST | /pagos/{id}/simulaciones | payment:simulate | Q | Orden autorizada más entorno/flag/negocio | Nombre EXISTENTE en contrato; enforcement PENDIENTE |
| 9 | POST | /pagos/{id}/tarjeta | payment:detail:create | U/S | Orden del padre autorizada, método/estado/detalle único | PROPUESTO, requiere fuente externa |
| 10 | GET | /pagos/{id}/tarjeta | payment:read | U/S | Autorizar padre, además de existencia del detalle | PROPUESTO, requiere fuente externa |
| 11 | POST | /pagos/{id}/transferencia | payment:detail:create | U/S | Orden del padre autorizada, método/estado/detalle único | PROPUESTO, requiere fuente externa |
| 12 | GET | /pagos/{id}/transferencia | payment:read | U/S | Autorizar padre, además de existencia del detalle | PROPUESTO, requiere fuente externa |

Consistente con Fase2.7 y catálogo interno. Solo simulate figura como x-required-permission en OpenAPI; los otros tres nombres siguen propuestos. Ningún permiso se concede por estar en una constante. Denegar lista requerida vacía/ausente, exigir todos los permisos exactos, sin wildcard/case folding/jerarquía ni ADMIN→simulate. Un scope general no acredita propiedad.

GET `/api/v1` es plantilla adicional fuera de las doce: decidir explícitamente política de health antes de activar guards; no crear excepción pública implícita.

## 9. Política de propiedad y alcance

Payment solo resuelve internamente el vínculo pag_id→ord_id. La fuente autoritativa determina acceso del par iss/sub y actor a esa orden/acción; la correspondencia con orden.usu_id debe existir en esa fuente mediante contrato aprobado. No copiar datos personales del propietario ni añadir columnas/FK/tenant para resolverlo localmente.

| Pregunta | Respuesta comprobada / necesidad |
|---|---|
| ¿Quién posee la orden? | SQL sitúa usu_id en Order; no hay consulta operativa ni linkage JWT confirmado |
| ¿Quién puede consultarla/crear pagos? | PENDIENTE de política autoritativa por acción; scope no basta |
| ¿Quién puede delegar? | PENDIENTE de emisor/registro M2M y prueba verificable de delegación |
| ¿Qué órdenes listar? | PENDIENTE de enumeración completa/consistente, no lista enviada por cliente |
| ¿Cómo devolver un pago existente? | Autorizar su orden antes de exponer respuesta, numero, monto o Location |
| ¿Cómo reintentar pag_numero? | Autorizar orden solicitada y persistida, incluida recuperación después de23505 |
| ¿Qué ocurre si Order/autoridad cae? | No autorizar ni usar alcance global; indisponibilidad propuesta503 |

Lecturas/detalles: después de autenticar y verificar permiso, obtener atributos mínimos del padre para autorizar, sin responder antes. Listados: restricción SQL del conjunto autorizado antes del total y limit/offset; no filtrar una página ya cargada ni contar filas globales. Crear y la rama de carrera/idempotencia deben pasar la misma política; no devolver200 de otro intento solo porque existe numero.

Para colisión con intento ajeno: propuesta403 genérico, sin devolver datos ni confirmar si el motivo es propiedad/numero;404 uniforme es alternativa de privacidad por aprobar con clientes. Conflictos409 y200 se conservan solo tras autorizar ambos recursos pertinentes. El contrato actual de reintento devuelve representación actual, así que el derecho a crear/reintentar debe incluir explícitamente leer esa representación; si no se aprueba, añadir payment:read al reintento sería otro cambio contractual, nunca tácito.

Una decisión no implica que orden exista con total/moneda válidos para cobrar: autorización y validación comercial son contratos distintos. orden_validacion=NO_VALIDADA no se cambia por introducir seguridad. No hay acceso directo a bases Order/Identity ni un ALLOW por faltar política.

## 10. Contrato remoto PROPUESTO de autorización

**No operativo, no aprobado y sin endpoint/proto creado.** Responsable candidato: servicio propietario de órdenes o autoridad de políticas que use atributos de Order mediante mecanismos autorizados. Preferencia de transporte gRPC por la arquitectura documental de Order; nombre/paquete/versión y dirección reales PENDIENTES. No reutilizar inventory.proto como si fuera Order.

### 10.1 Confianza, M2M y delegación

Payment se autentica como cliente M2M registrado mediante access token con audiencia de la autoridad, **diferente de asumir que el token recibido para Payment sirve en Order**. Transporte TLS verificado; mTLS es opción adicional pendiente de infraestructura. Credencial técnica y prueba de delegación se envían en metadata protegida, nunca en URLs/logs. No inventar scope/issuer operativo para esa llamada.

Dos modos candidatos a aprobar:

- SELF: servicio actúa por sí mismo. La identidad solicitante se vincula a la credencial M2M verificada y su registro/alcance; no puede afirmar ser otro usuario. Sin concesión de acceso a órdenes concretas, DENY.
- DELEGATED: la autoridad exige una prueba firmada/token delegado de audiencia apropiada que vincule sujeto original iss/sub, actor Payment/client_id, acción/alcance y vigencia. Se obtiene del mecanismo de delegación/token exchange autorizado por Identity. **Ese mecanismo no está encontrado ni se implementa aquí**. Sin él, no se aceptan operaciones delegadas afirmando un sub en el body.

La autoridad valida al llamador y la prueba, y compara su vinculación con el request. Los campos de identidad del body describen la decisión solicitada, no prueban identidad. No confiar solo en que Payment envíe X-User-Id o un principal serializado. No reenviar al autorizador un access token cuya audiencia sea exclusivamente Payment. Quién puede pedir delegación y cómo se registran los clientes es una decisión bloqueante separada.

### 10.2 Operación candidata EvaluateOrderAccess

Solicitud conceptual, sin tokens reales ni configuración definitiva:

```json
{
  "contract_version": "candidate-1",
  "request_id": "identificador-de-correlacion-unico",
  "principal": {
    "issuer": "valor-pendiente-del-perfil",
    "subject": "identidad-opaca-verificada",
    "client_id": "cliente-verificado",
    "kind": "USER"
  },
  "action": "payment:create",
  "resource": { "kind": "ORDER", "order_id": "42" },
  "delegation_context_id": "referencia-vinculada-a-la-prueba-de-metadata"
}
```

Request exige versión soportada, request_id acotado, principal ya validado y acción exacta de la matriz; order_id es BigId string canónico. Caller M2M se obtiene del canal/credencial, no de un campo libre. Para operaciones por pag_id, Payment consulta su propia fila, extrae ord_id y solicita decisión para esa orden/acción; no permite sustituir ord_id por el enviado por el cliente para evitar el vínculo padre.

Respuesta de decisión candidata:

```json
{
  "contract_version": "candidate-1",
  "request_id": "mismo-identificador-de-correlacion",
  "decision": "ALLOW",
  "decision_id": "identificador-opaco-de-decision",
  "principal": {
    "issuer": "mismo-issuer-verificado",
    "subject": "mismo-subject-verificado",
    "client_id": "mismo-cliente-verificado",
    "kind": "USER"
  },
  "actor_client_id": "cliente-M2M-verificado-de-Payment",
  "action": "payment:create",
  "resource": { "kind": "ORDER", "order_id": "42" },
  "policy_version": "version-opaca-de-politica",
  "evaluated_at": "instante-UTC",
  "valid_until": "instante-UTC-limite"
}
```

La respuesta viaja por el canal autenticado de la autoridad; no se acepta una copia aportada por cliente. Payment valida esquema y vinculación completa request/actor/principal/acción/recurso/tiempos. policy_version no se interpreta como usu_id ni propietario. No devolver correo, datos del dueño, importe o credenciales. ALLOW solo existe tras decisión autoritativa confiable, nunca por truthiness, respuesta vacía o mero200 del transporte.

DENY devuelve decision=DENY y código público genérico NO_ACCESS, con misma vinculación y sin distinguir orden ajena/inexistente. Un fallo operacional devuelve decision=UNAVAILABLE con correlación y código genérico, sin stack/SQL. El futuro adaptador transforma ALLOW/DENY válidos a ResourcePolicyDecision y fallos de dependencia a POLICY_UNAVAILABLE; contrato inválido o falta de vinculación nunca autoriza. El puerto interno actual no valida un protocolo remoto ni transporta policy_version/validez: el adaptador deberá hacerlo antes de entregar una decisión. No se cambia ese puerto ahora.

En gRPC también se contemplan UNAVAILABLE/DEADLINE_EXCEEDED y UNAUTHENTICATED/PERMISSION_DENIED del **llamador M2M**, conforme a [los estados gRPC](https://grpc.io/docs/guides/status-codes/). Un rechazo de la credencial técnica de Payment es fallo de integración cerrado, no prueba de que el token del usuario sea inválido; propuesta503 externo y alerta interna. Solo un DENY de negocio autenticado se mapea a403 del usuario. No confundir ausencia de política con orden inexistente.

### 10.3 Enumeración candidata ListAuthorizedOrders

Autorizar cada ID de la página Payment por separado no resuelve total/offset ni asegura que esa página sea completa. Se propone una operación de enumeración de **IDs de órdenes autorizadas**, sin datos personales:

- Request inicial: versión, request_id, principal/actor/delegación autenticados como arriba, action=payment:read, page_size acotado y sin page_token inicial.
- Response: decision=ALLOW/DENY/UNAVAILABLE, scope_id opaco, policy_version, valid_until, vinculación de identidad/actor/acción, order_ids BigId strings y next_page_token opaco o ausencia de este al completar.
- Requests posteriores: mismo contexto y scope_id/page_token. La autoridad impide reutilizar cursor con otro sujeto/cliente/acción y mantiene **el mismo snapshot de alcance** en todas las páginas. Un token de página no es una concesión de acceso ni un JWT aceptable por Payment.
- Si el cursor/snapshot expira o cambia de versión durante el recorrido, invalidar el resultado completo; no mezclar páginas de distintas políticas. Un ALLOW con conjunto vacío completo significa cero filas permitidas, nunca consulta global.

Payment reúne el conjunto completo dentro de un presupuesto y solo entonces ejecuta consultas parametrizadas de pagos con `ord_id` dentro de ese conjunto. Aplica a la misma restricción filtros estado/metodo/ord_id del cliente, total, orden pag_fecha DESC/pag_id DESC y limit/offset. El total cuenta **pagos** autorizados antes de paginar, no órdenes. Si se aprueba consistencia de items/total en un mismo snapshot PostgreSQL local, debe diseñarse/probarse aparte; no inferirla de una política remota.

Propuesta inicial de límites: páginas de hasta1000 IDs, hasta10000 IDs por alcance y presupuesto total2s, todos PENDIENTES de benchmark/aprobación. Si no puede obtenerse el conjunto completo/vigente, no devolver página parcial con total falso ni ampliar acceso: indisponibilidad503 candidata. El límite no truncará silenciosamente el alcance. **Escalabilidad queda bloqueada** para usuarios con conjuntos mayores hasta aprobar una alternativa de consulta/autorización federada o una restricción contractual explícita. No añadir tabla/columna de ownership en Payment para evitar este gate.

Alternativa por aprobar para despliegue limitado: aceptar listado solo con ord_id autorizado, evitando enumerar todo. Cambia la opcionalidad contractual del filtro, así que no es un fallback invisible ni está aprobado. No exponer el listado global mientras falte una solución completa.

### 10.4 Timeouts, caché y disponibilidad

PROPUESTO: deadline500ms por EvaluateOrderAccess o página de listado, presupuesto total2s por operación de autorización y valid_until máximo5s, siempre menor o igual a la vigencia restante de credenciales/prueba. Valores no aprobados. Propagar deadline/cancelación; no abrir transacciones/bloqueos PostgreSQL mientras se espera indefinidamente una llamada. Las [guías de deadlines gRPC](https://grpc.io/docs/guides/deadlines/) justifican límites explícitos; estos tiempos concretos son candidatos del proyecto.

No caché entre requests para decisiones de escritura. Para lecturas, inicialmente solo memoización por request vinculada a issuer/subject/clientId/kind/actor/acción/orden/policy_version. Nunca reutilizar decisión de otra identidad, de otra acción o más allá de token/delegación/valid_until. Sin stale-if-error; fallos/ausencia de decisión implican denegación de ejecución, no respuesta exitosa vacía. Reintentos acotados de operaciones de consulta solo si caben en el presupuesto aprobado; no reintentar efectos de negocio por una caída de políticas.

### 10.5 Carreras, propiedad y reintentos de pag_numero

El SQL muestra dueño de orden, pero no documenta si puede cambiar. Decisión BLOQUEANTE: elegir entre propiedad inmutable garantizada por la autoridad, o concesión/lease de acción cuya validez incluya cambios y revocación coordinados. Un chequeo remoto seguido de escritura local tiene carrera TOCTOU; reconsultar antes del commit reduce la ventana, pero no produce atomicidad distribuida. Los5s candidatos no resuelven ese problema por sí mismos. No habilitar escrituras basándose en una garantía inexistente.

Para lecturas/listados se debe aprobar la consistencia de alcance por snapshot y la ventana de revocación aceptable. Si el negocio exige revocación inmediata/propiedad actual al commit, este protocolo mínimo no basta: hace falta un contrato de lease/consumo o coordinación adicional, fuera del alcance presente. Mantener bloqueadas las operaciones afectadas hasta acordarlo.

Creación/reintento futuro:

1. Autenticar, verificar permiso y autorizar orden_id solicitado antes de crear.
2. Si existe pag_numero, resolver su ord_id y autorizarla antes de devolver el200 actual o un409 que filtre datos. Si es otro alcance, error genérico de acceso aprobado.
3. Si INSERT pierde por23505, volver a aplicar autorización al intento ganador; no saltarla en la recuperación de carrera. Respetar validez de la decisión y evitar conservar locks durante RPC sin presupuesto.
4. Solo tras autorizar comparar la solicitud con el intento persistido y aplicar las respuestas actuales200/409. Unicidad SQL, bloqueo de simulación y detalles permanecen; no se agrega Idempotency-Key ni cambia la llave global de numero.

La política de colisiones ajenas y la temporalidad de decisiones requieren pruebas y aprobación contractual. Este algoritmo es diseño, no cambio aplicado a PagoService.

## 11. Diseño NestJS y adecuación de puertos

Todo lo siguiente es PROPUESTO/PENDIENTE, no archivos creados:

| Componente futuro | Ubicación candidata | Responsabilidad / gate |
|---|---|---|
| AuthModule | src/security/auth.module.ts | DI y configuración; no registrar hasta autorizar integración |
| JwtVerifierService | src/security/jwt/jwt-verifier.service.ts | Implementar JwtVerifierPort con biblioteca aprobada, firma/perfil de confianza |
| JWKS provider | src/security/jwt/jwks-provider.ts | URI fija, TLS, caché/rotación/timeouts; parámetros bloqueados por emisor |
| JwtAuthenticationGuard | src/security/guards/jwt-authentication.guard.ts | Extraer Bearer, invocar verifier y construir contexto sin almacenar token en principal |
| Claims/principal adapter | src/security/principal/access-token-principal.mapper.ts | Interpretar una fuente canónica validada y registro USER/SERVICE; no merge roles |
| PermissionsGuard / RequirePermissions | src/security/guards/ y decorators/ | Usar evaluador existente; exigir todos, denegar metadata ausente |
| PaymentAuthorizationService | src/security/policy/payment-authorization.service.ts | Resolver padre/orden, verificar decisión/caducidad y aplicar alcance a consultas/reintentos |
| ResourcePolicyPort adapter | src/security/policy/order-resource-policy.adapter.ts | M2M/delegación, RPC propuesto y validación de respuestas antes de ALLOW |
| Puerto de listado | src/security/policy/authorized-orders.port.ts, si se aprueba | Representar conjunto/snapshot completo; el puerto actual solo decide sobre un recurso |
| Errores/configuración | src/security/errors/ y config/security.config.ts | Resultados seguros/headers y fail-fast; sin AUTH_DISABLED como fallback |

JwtVerifierPort hoy distingue VERIFIED/INVALID_CREDENTIAL/VERIFICATION_UNAVAILABLE. Sus resultados no asignan estados HTTP ni verifican firma por sí mismos. VerifiedAccessToken no trae kind; el mapper necesita el perfil/registro aprobado, no inventar una clasificación desde sub. ResourcePolicyPort recibe principal/acción/recurso y no tiene protocolo remoto/listado/versionado/leases. Su evaluador comprueba formato/permisos/ausencia de política, pero un adaptador confiable debe resolver propiedad y caducidad; no implementar un adaptador ALLOW general para poder conectar guards.

Secuencia futura obligatoria: **extracción Bearer → firma criptográfica → claims/propósito → principal → permisos → alcance por recurso → negocio → operación/respuesta**. Validación de formato BigId/DTO puede anteceder a la resolución del recurso; nunca autoriza ni sustituye política. Guards corren antes de pipes: si un guard usa el ID debe validarlo por sí mismo; preferir orquestar acceso a recursos en el servicio después de pipes, antes de datos/efectos. Catalogar todas las llamadas de servicio para evitar un camino de reintento sin política.

Una vez aprobado, orden global de guards con DI explícito y probado, no por orden incidental de imports. Falta de configuración/política o una ruta nueva sin metadata debe impedir acceso. Definir readiness de claves/políticas aparte de liveness. No confundir un build exitoso de los contratos con autenticación activa.

## 12. Cambios OpenAPI pendientes

El YAML canónico Payment sigue versión interna1.1.0 y estado propuesto/no oficial. No se modificó. Ya declara BearerAuth global, pero su descripción dice no implementado; no declara401 y solo simulación declara403. No hay503, challenges ni permisos de las demás operaciones. Modelos exitosos y BigId se conservan.

| Cambio futuro | Coordinación requerida |
|---|---|
| Activar BearerAuth real y actualizar descripción | Perfil/emisor aprobados y transición de clientes; rompe acceso anónimo actual |
| 401 UNAUTHORIZED en doce operaciones | Mantener Error JSON y code; cliente debe obtener/renovar token |
| 403 FORBIDDEN por permiso/alcance | Incorporar respuestas donde faltan; no revelar dueño o datos del token |
| 403 SIMULATION_DISABLED | Conservar restricción/código actuales de simulación; no cambiar422 de creación production incidentalmente |
| 503 SECURITY_DEPENDENCY_UNAVAILABLE candidato | Aprobar semántica de claves/políticas/M2M indisponibles y política de reintentos |
| WWW-Authenticate | Declarar desafío Bearer y errores de credencial/scope según decisión |
| Tres permisos nuevos y alcance por recurso | Descripciones/extensiones aprobadas y concesiones reales |
| Total/items restringidos y posible filtro obligatorio | Coordinar semántica/versión; no truncar ni revelar total global |
| Reintentos/colisiones ajenas | Aprobar403/404 uniforme y garantizar autorización antes de200/409 |
| Simulación Q/delegación/producción | Documentar sin conferir privilegios por ADMIN |

PROPUESTO:401 sin credencial o token inválido,403 para token válido sin autorización y503 para dependencia insuficiente. Credenciales HTTP ambiguas pueden exigir400 invalid_request bajo política estricta; aprobar ese caso explícitamente. Challenges Bearer/error=invalid_token e insufficient_scope se basan en [RFC6750](https://www.rfc-editor.org/rfc/rfc6750.html); no reflejar token, kid, claves o causa interna en mensajes.

Conservar Error `application/json` y code en Payment; no migrar silenciosamente a ProblemDetails/RFC7807 porque el contrato general lo use. Cualquier traducción en Gateway necesita contrato de frontera. HTTP bearer mantiene BearerAuth:[]: no poner scopes OAuth en ese array; usar extensiones/descripciones o aprobar oauth2/openIdConnect aparte. La API key general no es fallback de Payment.

No hay procedimiento específico de incremento de versión encontrado para este corte. Aprobar release/versionado/transición de consumidores antes de activar; no elegir un número de versión ni un doble endpoint público por iniciativa de esta fase. No debilitar seguridad con bypass anónimo para mantener clientes antiguos.

## 13. Simulaciones

Mantener la conjunción futura: token verificado + principal autorizado + permiso exacto payment:simulate + alcance confiable de la orden + entorno development/test autorizado + SIMULATION_ENABLED=true + base aislada en test + negocio/transición/concurrencia válidos. Production siempre deniega aun con todo lo anterior. Orden recomendado: autenticación/permisos, control de entorno, resolución/autorización de recurso, transacción/negocio.

EXISTENTE: config fuerza false en production y default false; PagoService vuelve a comprobar producción/flag, protege writes test por destino y aplica locks/estado PENDIENTE, detalle TARJETA previo, motivo/fechas y única aprobación por orden. PROPUESTO: identidad Q/permiso JWT/alcance; PENDIENTE de proveedor y política. No usar flag como identidad, ni ADMIN como concesión. No se habilitó simulación ni se cambiaron reglas/entorno; la regresión usa las simulaciones ya configuradas en la base aislada.

## 14. Pruebas futuras de seguridad

Plan, no tests nuevos ni bypass aplicados ahora. U=unitarias; E=HTTP e2e con JWKS/IdP de fixtures; I=integración aislada PostgreSQL y autoridad de fixtures con canal autenticado.

| Caso | Nivel | Resultado esperado futuro |
|---|---|---|
| JWT ausente/malformado | U/E | 401 y challenge; sin operación |
| Firma incorrecta/clave equivocada/none/algoritmo no permitido | U/E | 401, sin decode como identidad |
| Issuer/audience incorrectos | U/E | 401, no seguir URLs del token |
| Expiración/nbf futuro/iat inválido o edad excesiva | U/E | Rechazo en fronteras de tolerancia acordadas |
| ID token de misma firma usado como access token | U/E | 401 por propósito/perfil |
| JWKS caído/caché vencida/kid desconocido | U/E | Verificar solo con clave vigente;503 si no hay confianza disponible,401 si JWKS válido sin kid |
| Rotación/purga | U/E | Prepublicación/solapamiento correctos, ninguna aceptación sin firma |
| Scope ausente/insuficiente/parcial/roles ADMIN | U/E | 403; exactitud/todos; ningún simulate implícito |
| Usuario sin recurso | U/E/I |403/404 aprobado, sin datos ni conteos ajenos |
| Servicio sin delegación o audiencia M2M incorrecta | U/E/I | No permite acceso; actor/subject/body no sustituyen prueba |
| Decisión con otra acción/orden/subject/caller, vencida o versión inválida | U/E/I | Nunca ALLOW; sin escritura |
| Listado mixto, vacío, varias páginas, snapshot cambiado/cursor robado | U/E/I | Alcance completo, total correcto; vacío no abre query global; fallo no devuelve éxito parcial |
| pag_numero ajeno y carrera23505 con ganador ajeno | U/E/I | Autorización en rama inicial y recuperación antes de responder; sin filtrar intento |
| Cambio de propiedad entre check/commit | U/I | Cumplir contrato de lease/inmutabilidad; bloqueado hasta que exista garantía aprobada |
| Autoridad caída/deadline/circuito abierto | U/E/I |503 candidato, no stale ni política global provisional |
| Simular sin permiso o fuera de alcance | U/E/I |403, cero transición |
| Simular en production con credencial válida | U/E |403 SIMULATION_DISABLED; ninguna escritura |
| Concurrencia de detalles/simulación/aprobaciones | I | Una creación/finalización válida; conflictos previos conservados |
| Respuestas/logs/trazas | U/E | Sin tokens/pruebas de delegación/Authorization/propietarios/SQL |

Reutilizar harness RS256 efímero únicamente para fixtures criptográficamente verificables, sin adoptarlo como IdP productivo ni verifier. La firma real debe atravesar la ruta del servidor futuro, sin overrideGuard/AUTH_DISABLED/token fijo. No conectar suites a proveedores reales. Mock de política solo en harness test explícito, nunca adaptador productivo que permita todo. Probar además el contrato de M2M y la vinculación de respuestas, no solo escenarios del principal ya fabricado.

Escrituras exclusivamente en NODE_ENV=test,127.0.0.1:5434/ms_payment_test; sin clientes/usuarios reales ni escrituras en bases externas. Cerrar fixtures/listeners y limpiar solo números propios. La simulación de errores de fuente no autoriza desarrollar endpoints remotos en esta fase.

## 15. Riesgos

- DDL y URLs documentales pueden confundirse con servicios disponibles: exigir evidencia operacional antes de programar valores.
- Perfil de identidad y fuente de propiedad son gates distintos: JWT válido no elimina acceso horizontal.
- El puerto interno carece de enumeración/lease y no impone confianza en decisiones remotas; no puede conectarse con un adaptador permisivo para avanzar.
- Paginación por páginas de órdenes no equivale a paginación por pagos. Alcance incompleto o total global filtran información; escalar requiere un contrato adicional, no truncado oculto.
- M2M sin delegación verificable convierte Payment/Gateway en confused deputy.
- Propiedad mutable crea carrera distribuida; un deadline o TTL corto no garantiza atomicidad.
- Caché JWKS y decisiones retrasan revocación: no prometer inmediatez no acordada.
- Activar JWT modifica acceso/errores de clientes y requiere transición contractual.
- Seguridad no vuelve reales los pagos ni valida moneda/importe/existencia comercial de Order.

## 16. Decisiones bloqueantes y evidencia requerida

| Gate | Estado | Evidencia/decisión para desbloquear |
|---|---|---|
| G1 Proveedor/registro | BLOQUEADO | Responsable y servicio autorizado operativo; flujos de usuario/M2M |
| G2 Perfil JWT | BLOQUEADO | iss/aud exactos, algoritmo, JWKS, claims/tipo, clocks/vida/rotación/revocación |
| G3 Permisos | PENDIENTE aprobación | Matriz, fuente canónica, kind, concesiones expresas de simulate |
| G4 Autoridad/contrato de alcance | BLOQUEADO | Dueño responsable, linkage iss/sub↔usuario, RPC y decisiones confiables |
| G5 Delegación M2M | BLOQUEADO | Registro Payment, aud/credenciales técnicas y prueba de actor/subject con emisor autorizado |
| G6 Listados/carreras | BLOQUEADO | Enumeración completa escalable y garantías de snapshot/inmutabilidad/lease, privacidad de reintentos |
| G7 HTTP/OpenAPI | PENDIENTE aprobación | Códigos/challenges/formato, política ajenos y transición/versionado con clientes |
| G8 Operación/dependencias | PENDIENTE | Biblioteca/versión autorizadas, TLS/red/readiness, límites y procedimientos de incidentes |

No se solicita material privado por chat. «Bloqueado» identifica decisiones de diseño, no autoriza a crear infraestructura para sortearlas. Las responsabilidades organizacionales deben asignarse; no se presume un equipo o proveedor inexistente.

## 17. Plan por etapas, sin avance automático

Todas las etapas futuras requieren autorización explícita. Se describen archivos candidatos, no creados.

| Etapa | Archivos previstos | Dependencias/decisión que desbloquea | Riesgos | Pruebas | Criterio de aceptación |
|---|---|---|---|---|---|
| 1 Preparación verificable | Borrador versionado del protocolo de políticas, authorized-orders.port.ts, contratos de fixtures y pruebas de config | Aprobar alcance1 y contratos candidatos; ningún proveedor real necesario para trabajo local | Fijar prematuramente claims/ownership, confundir dobles con seguridad real | Tipos, esquemas, negativos/binding/cursor y default deny locales | Protocolo revisable y sin adapter/provider conectado; todos los pendientes explícitos |
| 2 Verificación JWT | jwt-verifier.service.ts, jwks-provider.ts, mapper y security.config.ts; pruebas crypto | G1/G2 y biblioteca autorizada de G8 | Aceptar ID token, issuer falso, alg confusion, caché stale | Firmas reales, claims, propósito, rotación/fallo, sin red real en suites | JwtVerifierPort implementado con perfil aprobado; sin activar HTTP aún |
| 3 Autorización de recurso | order-resource-policy.adapter.ts, payment-authorization.service.ts, puerto/adaptador de listado | G3/G4/G5/G6; integración remota expresamente autorizada | Acceso horizontal, delegación falsa, total incorrecto, TOCTOU | Contrato M2M, vinculación, listados/reintentos/carreras/indisponibilidad | Ningún acceso sin alcance confiable; garantía temporal y escalabilidad aprobadas |
| 4 Integración HTTP | AuthModule, guards, RequirePermissions, wiring de rutas/servicios y cambios OpenAPI aprobados | Etapas2/3 y G7; transición de clientes | Cambios de status, ruta olvidada, bypass por retry o acceso directo | E2e firmadas en doce rutas, root/health explícito, errores sin filtración | Autenticación→permisos→alcance antes de datos/efectos; sin fallback anónimo |
| 5 Pruebas y despliegue | Suites completas y runbook/manifest de despliegue autorizados | Etapas anteriores y G8; TLS/red reales | Exposición de fixtures, rotación fallida, revocación lenta, simulación production | Regresión, contrato, incidentes/deadline, rotación y pruebas de red/readiness | Revisión final aprobada, secretos gestionados, prod sin simulación, rollback coordinado |

Etapa1 puede prepararse sin IdP real, pero no está autorizada por entregar este documento. Si G4/G6 siguen bloqueados, no declarar «autorización completa» por tener guards; cualquier entrega parcial de catálogos requiere alcance expresamente aprobado. La definición de un RPC no autoriza implementarlo en Order. **No avanzar a Fase2.8.2-B.**

## 18. Verificación de regresión y alcance de cambios

Ejecutados en orden con ejecutables .cmd de PowerShell, usando npx --no-install para el compilador local:

| Comando | Resultado |
|---|---|
| npx tsc --noEmit --incremental false | Cero diagnósticos, exit0 |
| npm run build | Aprobado |
| npm run lint | Aprobado |
| npm test |193 aprobadas,21 archivos |
| npm run test:e2e |11 aprobadas,1 archivo |
| npm run test:integration |54 aprobadas,1 archivo |
| **Total** |**258 aprobadas** |

Antes de las suites HTTP, docker inspect confirmó ms_payment_postgres_test running/healthy y puerto5434 limitado a127.0.0.1. Se comprobó configuración efectiva NODE_ENV=test, DB_HOST127.0.0.1, DB_PORT5434 y DB_DATABASE ms_payment_test, sin imprimir credenciales. Las suites mantienen checks previos y synchronize/dropSchema/migrationsRun=false. No se conectó a desarrollo, Identity u Order; no se hicieron migraciones/DDL ni cambios de secuencias/catálogos.

Cleanup existente comprueba cero registros propios de pagos y detalles; consulta posterior independiente confirmó ms_payment_test y cero filas IT restantes. Comparación SHA256 de116 archivos existentes registrados al inicio: ninguno cambiado, incluidos producción/tests, puertos/harness, configuración/entorno, package/lock, informes previos, contratos y SQL. Artefactos de build/.tmp se excluyen y están ignorados. Cambios de fases previas presentes en Git no se atribuyen a esta fase.

Único entregable nuevo: `docs/fase-2.8.2-a-contratos-integracion-seguridad.md`. El informe queda para revisión con bloqueos explícitos, sin alterar comportamiento REST. **JWT/guards/autorización HTTP siguen inactivos.**
