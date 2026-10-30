# Infraestructura compartida

Base opt-in para los proyectos independientes NestJS del workspace (catalogo: `ms-catalog`).
La guia de referencia real es `../../gu_a_de_integraci_n_y_flujo_de_trabajo.md`.
No reemplaza las configuraciones existentes de cada servicio.

Desde esta carpeta: `npm install` y `npm test`. Luego, desde cada microservicio:

```sh
npm install ../shared-infrastructure
```

Instalar las peerDependencies con la misma version mayor de NestJS que el servicio.
Empaquetar con `npm pack` e instalar el tarball para despliegues independientes;
incluir el paquete en el contexto Docker cuando se use una dependencia `file:`.
Copiar las variables de `../../.env.example` al `.env` del servicio y asignar una base Neon
y cola propias. Los validadores de entorno existentes deben adaptarse al integrar esta base.

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NeonDatabaseModule, RabbitMqModule, JsonSchemaModule } from '@booking/infrastructure';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), NeonDatabaseModule.forRootAsync(),
    RabbitMqModule, JsonSchemaModule],
})
export class AppModule {}
```

Servidor RMQ hibrido, dentro del bootstrap despues de crear `app`:

```ts
const config = app.get(ConfigService);
app.connectMicroservice(rabbitMqOptions(config));
// Solo en un servicio que implemente InventoryStockService:
// app.connectMicroservice(inventoryGrpcOptions(config, true));
app.enableShutdownHooks();
await app.startAllMicroservices();
await app.listen(Number(config.get('PORT') ?? 3000));
```

Consumidor: `@EventPattern('pago.exitoso')`; confirmar **despues** de persistir:

```ts
const channel = context.getChannelRef(); // context: RmqContext
channel.ack(context.getMessage());
// Errores permanentes: channel.nack(context.getMessage(), false, false).
// Configurar DLQ antes de produccion; evitar reencolado infinito.
```

Cliente Nest: inyectar `@Inject(RMQ_CLIENT) client: ClientProxy` y usar
`await lastValueFrom(client.emit(tipo, evento))`. Para publisher confirms explicitos,
inyectar `ConfirmedEventPublisher` y ejecutar `await publisher.publish(colaDestino, evento)`.
El publicador usa `amqp-connection-manager` sobre `amqplib`, canal confirm y mensajes
persistentes. Las colas se declaran antes del envio y se recuperan al reconectar.
Cada evento incluye `eventoId`, `tipo`, `fechaISO`, `origen`, `correlationId` y `data`.
La entrega puede repetirse: deduplicar por `eventoId` en el consumidor.
Para distribuir a varios servicios publicar a cada cola o configurar un exchange con bindings;
compartir una unica cola reparte mensajes entre consumidores.

Cliente gRPC: registrar `inventoryGrpcOptions(config)` con `ClientsModule.registerAsync`.
Se conserva `package inventory` del contrato real. Railway privado/TCP usa TLS=false;
un destino con terminacion TLS requiere TLS=true. El servidor base escucha TCP sin TLS;
configurar certificados si el propio proceso debe terminar TLS.
Distribuir `inventory.proto` con el artefacto y usar su ruta absoluta.

Validacion REST por parametro, con esquema JSON Schema draft-07:

```ts
const pipe = new JsonSchemaValidationPipe({
  type: 'object',
  required: ['correlationId'],
  additionalProperties: false,
  properties: { correlationId: { type: 'string', format: 'uuid' } },
});

// @Post()
// crear(@Body(pipe) body: ReservaRequest) { ... }
```

Importar `JsonSchemaValidationPipe` desde `@booking/infrastructure`.
Para `$ref` compartidos, inyectar `JsonSchemaValidator`, registrar con `addSchema` y
crear pipes con `pipe(schema)`. No compilar por peticion. Cada objeto del contrato
debe declarar `additionalProperties: false` si prohibe campos extra.
No usar directamente un documento OpenAPI como JSON Schema: extraer/convertir sus esquemas
y resolver referencias. No aplicar una validacion global de DTO que elimine campos
antes del pipe contractual.

`synchronize` y `migrationsRun` permanecen desactivados; aplicar SQL/migraciones controladas.
El SSL de PostgreSQL siempre usa `rejectUnauthorized: false`, segun el requisito.
Las variables de simulacion son referencia para el servicio de pagos; este paquete no ejecuta pagos.
