# ms_payment — REST v2 y Swagger UI

Microservicio NestJS12 del Sistema de Atracciones. Registra intentos y **simula** resultados: no procesa pagos reales ni llama a pasarelas o a ms_order.

## Rutas y contrato API-first

- Swagger UI: [http://localhost:3000/api/docs](http://localhost:3000/api/docs).
- Especificación JSON publicada: [http://localhost:3000/api/docs/openapi.json](http://localhost:3000/api/docs/openapi.json).
- Base de negocio: `http://localhost:3000/api/v2`.
- Contrato propuesto vigente: [contract/ms_payment-openapi-v2.yaml](contract/ms_payment-openapi-v2.yaml), OpenAPI3.0.3, info.version2.0.0.
- [Contrato v1](contract/ms_payment-openapi-v1.yaml): referencia histórica, sin alias HTTP activo.

Swagger lee el YAML v2 directamente. No existe otra definición generada a partir de decoradores. La UI está fuera del prefijo de negocio: `/api/docs`, no `/api/v2/api/docs`. El servidor documentado usa3000; al cambiar PORT, seleccionar el host/puerto local correspondiente antes de ejecutar peticiones.

| Método | Ruta relativa a /api/v2 |
|---|---|
| GET | /metodos-pago |
| GET | /metodos-pago/{id} |
| GET | /estados-pago |
| GET | /estados-pago/{id} |
| POST | /pagos |
| GET | /pagos |
| GET | /pagos/{id} |
| POST | /pagos/{id}/simulaciones |
| POST | /pagos/{id}/tarjeta |
| GET | /pagos/{id}/tarjeta |
| POST | /pagos/{id}/transferencia |
| GET | /pagos/{id}/transferencia |

GET `/api/v2` conserva la respuesta de plantilla Hello World!, fuera de las doce operaciones documentadas. Las rutas `/api/v1/...` no están expuestas. Los IDs BIGINT y montos se envían y devuelven como **strings**, sin conversión a Number. Los códigos de catálogo se conservan, incluido `PAYPHAL`.

## Instalar e iniciar

Requisitos: Node24, npm, Docker Desktop y la base local Payment ya preparada según las fases anteriores. Esta fase no inicializa ni migra PostgreSQL.

```bash
npm ci
npm run start:dev
```

Crear `.env` desde `.env.example` con credenciales locales; para la base de desarrollo existente usar127.0.0.1:5433/ms_payment, NODE_ENV=development. No subir el archivo. No activar sincronización TypeORM. SIMULATION_ENABLED se omite o queda false por defecto. PORT es opcional,3000 por defecto.

```bash
npm run build
npm run start:prod
```

`start:prod` es el nombre del script de arranque del código compilado, **no aprobación para desplegar esta API simulada en producción**. Distribuir `contract/ms_payment-openapi-v2.yaml` junto a `dist/`, package y node_modules: el arranque lo lee desde su ubicación relativa al módulo, sin depender del directorio de trabajo. Si falta o es inválido, el arranque falla; no se sustituye por un documento vacío. No se hizo despliegue a Render.

## Seguridad y simulaciones

**No hay JWT ni autorización HTTP activos.** BearerAuth y payment:simulate son intención contractual futura. El botón Authorize de Swagger no protege endpoints ni valida tokens. Swagger es documentación/consola local, no una consola segura de producción.

La simulación permanece deshabilitada por defecto y requiere habilitación explícita solo en desarrollo local o test aislado. Producción fuerza false y el servicio vuelve a denegar la simulación incluso si se intenta forzar el flag. Esta fase no habilita simulaciones. Las reglas de estado, detalles, unicidad y concurrencia se conservan.

Try it out envía peticiones reales al servidor seleccionado y puede escribir registros en esa base, aunque no mueve dinero. Usar exclusivamente datos ficticios. No enviar PAN, CVV/CVC, PIN, credenciales bancarias, cuentas o tokens de pasarelas. Tarjeta acepta solo marca, últimos4, titular ficticio, mes/año y país; transferencia solo metadatos de comprobante y referencia textual de adjunto, sin upload.

## Pruebas y PostgreSQL aislado

Crear `.env.test.local` desde `.env.test.example` con credenciales exclusivamente locales y mantenerlo ignorado por Git. Destino fijo:

```text
NODE_ENV=test
DB_HOST=127.0.0.1
DB_PORT=5434
DB_DATABASE=ms_payment_test
```

```bash
npm run db:test:up
npx --no-install tsc --noEmit --incremental false
npm run build
npm run lint
npm test
npm run test:e2e
npm run test:integration
npm run db:test:down
```

E2e/integración cargan `.env.test.local` y rechazan otro destino antes de conectar; no usan desarrollo. El Compose de pruebas tiene contenedor/volumen propios. La limpieza borra solo intentos creados por la suite y comprueba los detalles por CASCADE; no usa TRUNCATE ni cambia catálogos/secuencias. `db:test:down` conserva el volumen: no usar `down -v` para limpiar. TypeORM mantiene synchronize/dropSchema/migrationsRun=false.

La regresión incluye Swagger HTML/JS/CSS, la especificación completa, doce operaciones contrastadas con controladores, refs, conservación de esquemas, errores/ValidationPipe, ausencia de alias v1 y persistencia/concurrencia previas.

## Trazabilidad

- [Fase2.8.3 — Swagger/v2 y resultados](docs/fase-2.8.3-swagger-v2.md).
- [Contratos de seguridad2.8.2-A](docs/fase-2.8.2-a-contratos-integracion-seguridad.md).
- [Preparación interna de seguridad2.8.1](docs/fase-2.8.1-preparacion-seguridad.md).
- [Corrección de tipado2.8.1.1](docs/fase-2.8.1.1-tipado-typescript.md).
- [Diseño de seguridad2.7](docs/fase-2.7-diseno-seguridad.md).
- [BigId2.6](docs/fase-2.6-bigid.md) y [auditoría2.5](docs/auditoria-fase-2.5.md).

Las referencias v1 en informes anteriores describen su estado histórico; no son rutas operativas actuales ni se reescriben como si hubieran usado v2.
