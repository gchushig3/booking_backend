# Fase F — Swagger y OpenAPI

Fecha local: 2026-10-29, America/Guayaquil. Autorización: «Vamos con la Fase F».
Se completa F y se detiene antes de G, conforme al flujo aprobado por el usuario.

## 1. Inspección

Se revisaron AGENTS.md, decisiones A, contratos e implementación D/E, controladores,
DTOs, errores, configuración y pruebas. Los documentos obligatorios completos ya
se leyeron en A. SQL v2 sigue definiendo la persistencia y Booking es referencia
externa: su YAML original con claves duplicadas no se modifica ni se usa como
si definiera las rutas Identity. No se activa telemetría de producción.

Compatibilidad consultada en el registro npm y documentación primaria:
[introducción Swagger NestJS](https://docs.nestjs.com/openapi/introduction),
[operaciones](https://docs.nestjs.com/openapi/operations) y
[seguridad](https://docs.nestjs.com/openapi/security).

## 2. Implementación

Swagger UI exactamente /api/docs, público localmente, con assets servidos por el
paquete instalado, sin CDN. JSON en /api/docs-json y YAML en /api/docs-yaml.
Las 25 operaciones reales permanecen bajo /api/v2. No se documentan rutas futuras.

Se anotaron DTOs de entrada y salida, métodos, parámetros, paginación, restricciones,
ejemplos, nullables, identificadores BIGINT string y respuestas exitosas/errores.
204 no declara cuerpo. Los errores usan application/problem+json con esquema común;
X-Correlation-Id aparece como entrada opcional y cabecera de respuesta. 401 incluye
WWW-Authenticate y 429 Retry-After. DTOs rechazan propiedades desconocidas y
ProfileDto exige al menos una propiedad, como la implementación real.

Bearer JWT declarado solo en operaciones protegidas. Las públicas usan security=[];
la descripción administrativa exige ADMIN activo. No se cambia ningún guard ni
se deshabilita autenticación para Swagger. Authorize conserva el token solo en
memoria: persistAuthorization=false; validador externo de Swagger deshabilitado.
Scarf transitivo incorpora opción de analítica deshabilitada explícitamente en
package.json y stages Docker de instalación, sin conectar telemetría.

## 3. Archivos creados/modificados

Nuevos src/openapi/configure-openapi.ts, endpoint.ts y responses.ts.
Controladores auth, usuarios/roles y salud y DTOs correspondientes anotados;
configure-application.ts monta la documentación y mantiene prefijo/validación existentes.

Nuevos scripts/export-openapi.mjs, verify-phase-f.mjs y verify-swagger-browser.mjs.
package.json/package-lock.json incorporan @nestjs/swagger 12.0.5, yaml 2.9.1 y
swagger-parser 13.1.0 de desarrollo. Nuevos comandos openapi:export/openapi:check,
test:swagger-browser y smoke F como test:local-stack. Dockerfile deshabilita la
analítica de instalación; no incorpora credenciales ni claves privadas.

Nuevo test/integration/openapi.integration-spec.ts. Nuevos artefactos docs/openapi.json
y docs/openapi.yaml, evidencia F HTTP/navegador y este informe. README y contratos
actualizados al comportamiento vigente. Informes históricos A–E conservados.

## 4. Contratos utilizados

Contrato REST interno D/E, DTOs y reglas existentes; JWT RS256 aprobado, rol activo
actual y propiedad de recursos existentes. Exportación OpenAPI 3.0.0, versión API
2.0.0. Servidor relativo / para usar el origen actual sin duplicar /api/v2.
No se cambia esquema SQL, datos iniciales, contrato externo ni otros microservicios.
La extensión en texto del límite bcrypt de 72 bytes UTF-8 se conserva: OpenAPI
no expresa por sí solo ese límite de bytes con maxLength Unicode.

## 5. Endpoints funcionales

- http://localhost:3011/api/docs — interfaz ejecutable pública local.
- http://localhost:3011/api/docs-json — contrato JSON público.
- http://localhost:3011/api/docs-yaml — contrato YAML público.
- 13 operaciones auth, nueve de usuarios/roles, JWKS y dos sondas, sin cambio de rutas.

README describe registro, login, copia de access_token en Authorize, ambos me,
denegación CLIENTE y acceso ADMIN con el bootstrap CLI explícito de E. Mailpit
permite completar verificación/recuperación. Refresh no se utiliza como Bearer.

## 6. Pendientes/bloqueos

No quedan bloqueos en la documentación ni en el flujo local comprobado.
La cuenta ADMIN permanente no se crea automáticamente: sigue el procedimiento
explícito de README. Las pruebas usan cuentas temporales y las eliminan.
G/H siguen pendientes de aprobación. No se despliega ni se crean recursos Azure,
Render, registros de imágenes remotos o pipelines CD. Catalog no se modifica.

## 7. Comandos ejecutados

Desde microservices/ms_identity, npm.cmd en PowerShell:

```sh
npm install --save-exact @nestjs/swagger@12.0.5 yaml@2.9.1 --ignore-scripts --no-audit --no-fund
npm install --save-dev --save-exact @apidevtools/swagger-parser@13.1.0 --ignore-scripts --no-audit --no-fund
npm run build
npm run openapi:export
npm run openapi:check
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run test:integration
docker compose up -d --build --wait
npm run test:local-stack
npm run test:swagger-browser
npm run format:check
```

También Prettier sobre archivos editados y consultas finales de salud, limpieza y
huella SQL. La exportación usa AppModule/controladores reales y conexión local
configurada, sin abrir puerto HTTP ni ejecutar operaciones de negocio. Formatea
ambos artefactos y valida sin referencias externas; --check compara su contenido.

## 8. Resultados reales

| Comprobación                                | Resultado              |
| ------------------------------------------- | ---------------------- |
| Build host/Docker, typecheck, lint, formato | Aprobados              |
| Unitarias                                   | 44 / 44                |
| E2E HTTP aisladas                           | 8 / 8                  |
| Integración PostgreSQL/auth/RBAC/OpenAPI    | 59 / 59                |
| Total Jest                                  | 111 pruebas, 11 suites |
| OpenAPI 3 JSON/YAML y sincronización        | Aprobados              |
| HTTP Swagger en Docker                      | Aprobado               |
| Try it out en Chrome headless real          | Aprobado               |

Seis pruebas nuevas F validan UI/assets/JSON/YAML públicos, igualdad con artefactos,
25 rutas reales, seguridad contrastada con metadata de guards, DTOs, ausencia de
secretos, registro/login reales, 400/401/403/409, correlación y acceso ADMIN real.
Las restantes incluyen las pruebas D/E y persistencia C. No se sustituyen guards
ni JWT en la integración.

[Evidencia HTTP](fase-f-evidence.json) y [evidencia Chrome](fase-f-browser-evidence.json).
Chrome con perfil temporal aislado ejecutó formularios Try it out, no fetch de
reemplazo: registro 201, login público 200, autorización Bearer mediante la API
pública de Swagger UI, auth/me y users/me 200, users con CLIENTE 403 y consultas
administrativas con ADMIN 200. Se verificó en tráfico de navegador que login no
envía Authorization aun cuando Authorize tenía un token y que no se guarda en
localStorage. El bootstrap ADMIN fue la CLI real. Credenciales/respuestas con
tokens no se guardan en evidencias ni se imprimen.

Se corrigieron selectores de expansión/tabla en el automatizador Chrome y se
normalizaron propiedades undefined al comparar el documento en memoria con JSON;
se repitieron esas verificaciones hasta finalizar correctamente. No se relajaron
los guards, validaciones o límites de intentos para hacerlas pasar.

## 9. Riesgos y límites

La prueba opcional Chrome necesita instalación local (CHROME_PATH configurable),
ausencia de asignaciones ADMIN previas y límites de intentos vigentes. Rechaza
modificar un ADMIN existente. Elimina exclusivamente sus cuentas, mensajes,
credenciales temporales y perfil aislado; no toca el perfil real del usuario.
Las pruebas no sustituyen la aprobación de G/H ni una configuración de producción.
SMTP/claves/rate limit local conservan los límites documentados D/E.
Docker reportó cero vulnerabilidades de producción y seis bajas de desarrollo
ya presentes; no se aplicó audit fix --force. Continúa el aviso VM Modules de Jest.

## 10. Criterios y siguiente aprobación

Se cumple F: Swagger público funcional, 25 operaciones reales documentadas,
distinción pública/Bearer/ADMIN verificada, DTOs/respuestas/errores/correlación,
JSON/YAML exportables válidos y prueba real de uso de la interfaz. SQL original
y otros microservicios intactos. Se detiene aquí y solicita autorización para
Fase G — Pruebas y verificación global.
