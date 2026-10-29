# MS Pricing Service (gRPC)

Microservicio de pricing del Sistema de Atracciones (Descubre EC).

- **Responsabilidad:** Gestionar las tarifas de atracciones: tabla `tarifa`.
- **Contrato:** gRPC (`PricingService` / paquete `pricing`), transporte HTTP/2 sobre TCP.
- **Base de datos:** `ms_pricing` (database-per-service, tabla `tarifa`).
- **Dependencias externas:** Ninguna (no consume otros microservicios).

## Contrato gRPC (`src/pricing.proto`)

| RPC | Descripcion | Tipo |
|---|---|---|
| `ObtenerPrecio` | Consulta puntual de precio por `tarId` | Unary |
| `ListarPrecios` | Streaming de la lista de precios | Server Streaming |
| `ListarPreciosPorTipo` | Streaming de precios filtrados por tipo (`tarTipo`) | Server Streaming |

Mensajes: `PrecioRequest { int32 tarId = 1 }`, `PrecioResponse { int32 tarId, int32 atrId, string tarTipo, double tarPrecio, string tarMoneda }`, `PrecioPorTipoRequest { string tarTipo = 1 }`.

Los nombres de campos usan **camelCase** (`tarId`, `tarTipo`), que es el formato que genera `@grpc/proto-loader` al convertir los snake_case del `.proto` para TypeScript/JavaScript. El identificador en base de datos se conserva conceptualmente como `tar_id` (tabla `tarifa`).

## Ejecucion local

```bash
npm install
npm run start:dev     # microservicio gRPC escuchando en 0.0.0.0:50051
node cliente.js        # cliente de prueba gRPC
```

Servidor gRPC: `0.0.0.0:50051` (variable de entorno `GRPC_PORT`).

## Tests

```bash
npm run test          # unit tests
npm run test:e2e      # e2e tests
```

## Despliegue

- Render: `render.yaml` (start: `npm run start:prod`).
- Railway: `railway.json` (start: `npm run start:prod`).

Fuera de alcance en esta fase: persistencia con PostgreSQL/TypeORM (prototipo en memoria).
