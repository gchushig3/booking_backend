# Fase G — Pruebas y Docker local

Fecha: 2026-10-28, America/Guayaquil. Autorización explícita: «Si vamos con la fase G».

## 1. Resumen

Se ejecutaron lint, formato, typecheck, build, pruebas unitarias, integración PostgreSQL,
e2e y verificación de OpenAPI. Se reconstruyó y arrancó el stack Docker local,
se verificaron sus consultas HTTP y Swagger y se reiniciaron aplicación y PostgreSQL
para comprobar la conservación del volumen y los datos.

La nueva prueba HTTP con AppModule y servicios reales detectó y permitió corregir
un error SQL al resolver atracciones por ID numérico. Las pruebas anteriores con
servicios mock no detectaban ese error. Las fixtures se crearon únicamente en
`ms_catalog_test`, con limpieza por sus IDs al terminar.

No se habilitó autenticación ficticia ni se realizó despliegue. Los tres contenedores
de Compose quedan en ejecución local: aplicación, PostgreSQL de Catalog y PostgreSQL
aislado de pruebas. No se eliminaron volúmenes de Compose.

## 2. Archivos creados o modificados

Nuevos:

- `test/integration/http.integration-spec.ts`: 14 casos con AppModule, servicios y
  repositorios reales, sin overrides ni bypass del guard.
- `scripts/verify-local-stack.mjs`: comprobación reproducible del stack real, de
  seguridad del contenedor, HTTP, Swagger y persistencia tras reinicio.
- `docs/fase-g-evidence.json`: evidencia generada de versiones, imagen, esquema,
  volumen y comprobaciones, sin credenciales.
- `docs/fase-g.md`: informe de la fase.

Modificados:

- `src/modules/attractions/attractions.service.ts`: parámetros separados para ID y
  slug, y control del límite bigint antes de consultar la columna numérica.
- `test/unit/attractions.service.spec.ts`: ajuste del doble de repositorio a los
  parámetros separados. La regresión se prueba contra PostgreSQL real.
- `scripts/export-openapi.mjs`: genera la matriz Markdown con Prettier para que
  `format:check` y `openapi:check` sean compatibles y reproducibles.
- `docs/endpoints.md`: matriz regenerada con formato consistente.
- `package.json`: comando `test:local-stack`.
- `README.md`: instrucciones, estado y límites de las verificaciones reales.
- Archivos de `src`, `test` e informes `docs/fase-d.md` y `docs/fase-e.md` señalados
  por Prettier: únicamente normalización de formato, salvo los cambios funcionales
  y de pruebas enumerados arriba.

Dockerfile y archivos Compose existentes funcionaron sin cambios funcionales.
No se modificaron SQL maestro, migración aprobada, contrato externo, otros
microservicios, secretos existentes ni versiones de dependencias.

## 3. Decisiones técnicas

La suite ORM mantiene transacciones y savepoints. La nueva suite HTTP usa fixtures
confirmadas para que sean visibles por las diferentes conexiones del pool de Nest.
Comprueba primero `NODE_ENV=test`, base `ms_catalog_test` y destino loopback:5445;
limpia únicamente los IDs que creó, sin truncar tablas ni reiniciar secuencias.

El smoke test de Docker es de lectura salvo el reinicio explícito de los dos
contenedores del proyecto verificado. No inserta fixtures en `ms_catalog`.
Compara snapshots antes/después y exige conservar el mismo volumen.
El bootstrap utiliza sus propios contenedores y una copia temporal del SQL para
inyectar el fallo; al terminar limpia exclusivamente esos recursos temporales.

El motor Docker estaba disponible, pero el sandbox no tenía permiso sobre su pipe.
La ejecución elevada fue aprobada. No fue necesario modificar la política de
PowerShell; se utilizó `npm.cmd`.

## 4. Contratos verificados

- Consultas públicas de `/api/v2`: listado, detalle por ID/UUID/slug, búsqueda por
  datos propios, categorías, idiomas e inclusiones.
- Paginación y carga real de relaciones, tipos numéricos y orden de fotografías.
- Ocultación HTTP de borradores, inactivas y eliminadas lógicamente.
- Errores de validación y recurso ausente, en formato Problem Details.
- Las 30 operaciones administrativas continúan bloqueadas con
  `401 AUTHENTICATION_UNAVAILABLE`, incluso con un Bearer falsificado.
- Swagger UI, recursos estáticos, JSON/YAML y coincidencia del YAML servido por
  la aplicación Docker con el archivo exportado.
- `X-Correlation-Id` propagado en HTTP real.

No se cambian rutas ni DTOs ni se implementan integraciones externas.

## 5. Comandos ejecutados

Desde `microservices/ms-catalog`:

```sh
node --version
npm.cmd --version
docker --version
docker compose version
docker info --format '{{.ServerVersion}}'
docker compose config --quiet
docker compose --env-file .env.test -f compose.test.yaml config --quiet
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd run test:integration
npm.cmd run openapi:export
npm.cmd run openapi:check
docker compose up -d --build --wait --wait-timeout 120
docker compose --env-file .env.test -f compose.test.yaml up -d --wait --wait-timeout 60
node scripts/verify-docker-bootstrap.mjs
node scripts/verify-local-stack.mjs
```

Se utilizó Prettier para corregir las diferencias encontradas.
El último script también ejecuta `docker compose restart postgres app`, espera
sus healthchecks y repite las comprobaciones HTTP y SQL.
Los comandos `npm run test:docker-bootstrap` y `npm run test:local-stack` invocan
esos mismos scripts para futuras ejecuciones.

## 6. Resultados reales

| Verificación                                                | Resultado                |
| ----------------------------------------------------------- | ------------------------ |
| Formato Prettier                                            | Aprobado                 |
| ESLint, cero warnings                                       | Aprobado                 |
| TypeScript                                                  | Aprobado                 |
| Build local e imagen Docker multietapa                      | Aprobados                |
| Unitarias                                                   | 52 aprobadas, 7 suites   |
| E2E HTTP con dobles de servicio                             | 57 aprobadas, 3 suites   |
| Integración ORM con PostgreSQL real                         | 50 aprobadas, 1 suite    |
| Integración HTTP/AppModule con PostgreSQL real              | 14 aprobadas, 1 suite    |
| Total Jest                                                  | 173 aprobadas, 12 suites |
| Contrato OpenAPI y matriz reproducibles                     | Aprobado                 |
| Compose principal y Compose de pruebas                      | Saludables               |
| Bootstrap limpio y rollback ante fallo SQL                  | Aprobados                |
| HTTP/Swagger y 30 denegaciones administrativas en Docker    | Aprobados                |
| Persistencia y HTTP después de reiniciar ambos contenedores | Aprobados                |

Entorno comprobado: Node host 24.21.0, npm host 12.2.0, Docker Engine 29.8.0,
Compose 5.5.1, Node del contenedor 24.22.1 y PostgreSQL 16.15.
El ID exacto de imagen y el instante UTC están en `fase-g-evidence.json`.

La base local conserva exactamente diez tablas, cuatro dominios y
`v_atraccion_completa`; se verificaron los seis seeds de categorías y cuatro de
idiomas. Antes y después del reinicio había cero operadores y cero atracciones
en `ms_catalog`: no se introdujeron datos ficticios como datos operativos.

Se comprobó ejecución como usuario `node` con UID distinto de cero, raíz de
filesystem de solo lectura, capacidades eliminadas, `no-new-privileges` y ausencia
de `.env`/`.env.test` dentro de la imagen.

## 7. Errores detectados y corregidos

1. **Consulta por ID numérico: HTTP 500.** PostgreSQL devolvía SQLSTATE `42883`,
   `operator does not exist: character varying = bigint`. Un mismo parámetro se
   utilizaba en `atr_id = :val OR atr_slug = :val`. Se separaron los parámetros
   conservando la búsqueda por slug numérico y evitando conversión a Number.
   La corrección aplica también al método interno administrativo de búsqueda.
2. **Identificador mayor que bigint.** Se evita consultarlo como ID numérico;
   sigue pudiendo resolverse como slug y devuelve 404 cuando no existe.
3. **Formato.** La comprobación inicial señalaba 22 archivos. Se normalizaron
   y se ajustó el generador de la matriz. La evidencia JSON se genera con el
   mismo formato para que futuras ejecuciones no rompan `format:check`.

El fallo de integración inicial quedó reproducido antes de corregirlo; la suite
final completa pasó con la corrección.

## 8. Bloqueos, riesgos y pendientes

- La creación, actualización y conflictos mediante HTTP administrativo autorizado,
  RBAC y propiedad por operador siguen bloqueados por el contrato Identity.
  No se desactivó el guard para probarlos ni se declara que estén verificados.
- Location, Review y transiciones formales de publicación siguen pendientes de
  sus respectivos contratos aprobados.
- La comprobación de persistencia usa reinicio y el mismo volumen; no simula
  pérdida de disco, backup/restore ni eliminación/recreación de volúmenes.
- `/health/live` es liveness, no una sonda continua de disponibilidad PostgreSQL.
- La instalación durante el build informó seis avisos de vulnerabilidad de
  severidad baja en el conjunto con dependencias de desarrollo, y cero en la
  instalación con `--omit=dev`. No equivale a una auditoría de seguridad completa;
  no se ejecutaron actualizaciones forzadas de versiones.
- No se realizó inspección visual en navegador; Swagger se comprobó por HTTP.
- El directorio mantiene el estado Git previo de archivos sin seguimiento;
  `git rev-parse --show-toplevel` confirma una raíz Git propia en `ms-catalog`.
  La rama `main` todavía no tiene commits; no se crearon commits ni se publicó
  un repositorio remoto en esta fase.

## 9. Criterios de aceptación cumplidos

Lint, build y las tres clases de pruebas se ejecutaron; los resultados reales
quedaron registrados. Se arrancó la aplicación completa con PostgreSQL 16 en
Docker, se verificó Swagger y el esquema original y se comprobó persistencia.
El SQL y los contratos externos se preservaron, sin acceso entre bases de
microservicios, bypass de autenticación, despliegue ni publicación de imágenes.

## 10. Autorización siguiente

Detener al finalizar G. Solicitar autorización explícita para Fase H:
revisión final y entrega técnica local con documentación, matriz y pendientes.
Esa entrega debe conservar explícito el bloqueo de la administración real.
No realizar despliegue.
