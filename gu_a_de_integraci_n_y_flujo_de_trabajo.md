# Guía de Integración, Gobernanza y Arquitectura del Sistema de Atracciones (Integración con Booking)

---

## 1. Mapeo Semanal de Flujos de Trabajo (Semanas 1 a 7)

Este flujo de trabajo define el ciclo de vida del desarrollo backend paso a paso, optimizado para ser consumido por desarrolladores y agentes de IA en VS Code (GitHub Copilot y Codex) con el mínimo consumo de tokens.

### Semana 1-2: Fundamentos REST & OpenAPI Contract-First
* **Objetivo:** Implementar la API REST de Atracciones siguiendo de forma inmutable el contrato `atracciones-openapi-v3.yaml`.
* **Flujo de Trabajo:**
  1. **Aislamiento del Contrato:** Cargar `atracciones-openapi-v3.yaml` en el contexto local. Nunca editar tipos o rutas de las operaciones del Booking.
  2. **Validación Schema-First:** Configurar `JsonSchemaValidationPipe` con `ajv` para validar payloads de entrada (`POST /reservas`, `POST /checkout`) contra esquemas JSON derivados del YAML.
  3. **Seguridad Básica:** Aplicar `@nestjs/throttler` (Rate Limiting), `helmet` para cabeceras HTTP seguras, y validación estricta de DTOs descartando propiedades no declaradas (`whitelist: true`, `forbidNonWhitelisted: true`).
  4. **Conexión a Base de Datos:** Configurar TypeORM/Prisma con soporte para SSL hacia **Neon PostgreSQL** (`sslmode=require`).

### Semana 3: Microservicio gRPC de Control de Aforo (Railway)
* **Objetivo:** Exponer el servicio sincrónico de alto rendimiento para consulta y reserva de cupos en tiempo real mediante `inventory.proto`.
* **Flujo de Trabajo:**
  1. **Compilación de Proto:** Utilizar `ts-proto` o el cargador dinámico `@grpc/proto-loader` de NestJS respetando el paquete y nombres del archivo `inventory.proto`.
  2. **Servidor gRPC:** Escuchar en el puerto por defecto (e.g. `50051`) configurado para ejecutarse de forma nativa en **Railway**.
  3. **Manejo de Errores gRPC:** Transformar excepciones de dominio a códigos de estado gRPC genéricos (`status.NOT_FOUND`, `status.RESOURCE_EXHAUSTED`, `status.UNAUTHENTICATED`).
  4. **Log de Alto Rendimiento:** Implementar un interceptor gRPC ligero sin consumo excesivo de memoria/I/O.

### Semana 4: GraphQL Aggregator / BFF (Backend-For-Frontend)
* **Objetivo:** Proveer un punto de entrada unificado para los clientes móviles y web sin incurrir en *overfetching* o *underfetching*.
* **Flujo de Trabajo:**
  1. **Esquema Code-First:** Definir modelos `@ObjectType()` y resolvers `@Resolver()` para combinar información de Atracciones (REST) y Disponibilidad en tiempo real (gRPC).
  2. **Apollo Sandbox / Engine:** Configurar `@nestjs/graphql` con Apollo Driver y `autoSchemaFile` generado en la raíz (`schema.gql`).
  3. **Integración HTTP:** Utilizar `HttpModule` con `@nestjs/axios` usando `firstValueFrom` para consumir endpoints de microservicios REST.

### Semana 5: Integración SOA / Mensajería Asíncrona (CloudAMQP)
* **Objetivo:** Publicar eventos de dominio asíncronos cuando ocurren acciones críticas en el sistema.
* **Flujo de Trabajo:**
  1. **Conexión CloudAMQP:** Configurar cliente `amqplib` o `@nestjs/microservices` con URL de transporte remota `amqps://user:pass@cloudamqp-host/vhost`.
  2. **Estructura del Evento:** Definir cargas de eventos normalizadas conteniendo: `eventoId` (UUIDv4), `tipo`, `fechaISO`, `origen` y `correlationId`.
  3. **Publicación Idempotente:** Garantizar que los mensajes enviados a CloudAMQP incluyan confirmación de canal (*publisher confirms*).

### Semana 6: Saga Transaccional de Checkout y Reserva (EDA + Coreografía)
* **Objetivo:** Ejecutar la secuencia distribuida: **Reserva Creada $\rightarrow$ Aforo Reservado $\rightarrow$ Pago Simulado $\rightarrow$ Confirmación / Compensación**.
* **Flujo de Trabajo:**
  1. **Trazabilidad Distribuida:** Requerir y propagar el campo `correlationId` (o `X-Correlation-ID`) en todas las peticiones HTTP y eventos AMQP.
  2. **Camino Feliz:**
     * `AtraccionService` emite `reserva.creada` $\rightarrow$ `InventoryService` reserva cupo y emite `aforo.reservado` $\rightarrow$ `PaymentService` simula cobro y emite `pago.exitoso` $\rightarrow$ Reserva confirmada.
  3. **Flujo de Compensación (Rollback Distribuido):**
     * Si `PaymentService` emite `pago.fallido`, `InventoryService` escucha dicho evento, libera el cupo reservado previamente y emite `aforo.liberado`, dejando la reserva en estado `CANCELADA`.

### Semana 7: Gobernanza de Contratos y Validación Schema-First
* **Objetivo:** Garantizar la evolución segura de los APIs y evitar *Breaking Changes*.
* **Flujo de Trabajo:**
  1. **Verificación Automatizada de Compatibilidad:** Implementar script `check-compatibility.js` para comparar esquemas antes de cada despliegue.
  2. **Reglas de Evolución:**
     * **Permitido:** Agregar campos opcionales, agregar nuevos endpoints.
     * **Prohibido (Breaking Change):** Eliminar campos, cambiar tipos de datos, volver requeridos campos previamente opcionales.
  3. **Pipeline de Integración:** Bloquear builds si el validador `ajv` o la comparación de OpenAPI/Proto reporta incompatibilidad con la versión en producción.

---

## 2. Arquitectura Global del Sistema

El sistema utiliza una arquitectura **Database-per-Service** descentralizada, combinando comunicación sincrónica para consultas rápidas y comunicación asíncrona basada en eventos para la orquestación/coreografía de transacciones distribuidas.

```
+-----------------------------------------------------------------------------------+
|                                 CLIENTES / BOOKING                                |
+-----------------------------------------------------------------------------------+
       | (HTTP / REST OpenAPI v3)                       | (GraphQL Query/Mutation)
       v                                                v
+-----------------------------+               +-----------------------------------+
|  Atracciones REST API       |               |  GraphQL BFF / Aggregator         |
|  (Azure Container Apps)     |               |  (Azure Container Apps)           |
+-----------------------------+               +-----------------------------------+
       |                                                |
       | (SQL)                                          | (gRPC / inventory.proto)
       v                                                v
+-----------------------------+               +-----------------------------------+
|  Neon PostgreSQL DB 1       |               |  Inventory gRPC Microservice      |
|  (Atracciones / Reservas)   |               |  (Railway Deployment)             |
+-----------------------------+               +-----------------------------------+
       |                                                |
       | (Eventos / CloudAMQP - AMQPS)                  | (SQL)
       +-----------------------+                        v
                               |              +-----------------------------------+
                               v              |  Neon PostgreSQL DB 2             |
               +-------------------------------+ (Inventario / Aforo)             |
               |  CloudAMQP Event Broker       | +-----------------------------------+
               |  (RabbitMQ Managed)           |
               +-------------------------------+
                               |
                               | (Eventos: pago.procesado / pago.fallido)
                               v
               +-------------------------------+
               |  Payment Simulation Service   |
               |  (Azure Container Apps)       |
               +-------------------------------+
```

---

## 3. Especificación Técnica de Microservicios e Infraestructura

### 3.1. Microservicio de Atracciones y Reservas (Core REST)
* **Despliegue:** Azure Container Apps / App Service.
* **Base de Datos:** **Neon PostgreSQL** (`atracciones_db`).
* **Contrato Principal:** `atracciones-openapi-v3.yaml` (Inmutable).
* **Responsabilidades:**
  * Catálogo de atracciones turísticas, tickets, horarios y reglas de check-in.
  * Creación inicial de reservas y ciclo de vida HATEOAS.
  * Publicación de eventos de dominio a CloudAMQP.

### 3.2. Microservicio de Inventario y Aforo (gRPC)
* **Despliegue:** **Railway** (Puerto gRPC expuesto en TCP público/interno).
* **Base de Datos:** **Neon PostgreSQL** (`inventory_db`).
* **Contrato Principal:** `inventory.proto` (Inmutable).
* **Responsabilidades:**
  * Control de aforo en tiempo real con bloqueo concurrente atómico.
  * Respuestas en sub-milisegundos vía gRPC.
  * Listener de eventos de compensación en CloudAMQP para liberar aforo tras fallos de pago.

### 3.3. Microservicio de Pagos (Simulación)
* **Despliegue:** Azure Container Apps.
* **Base de Datos:** Neon PostgreSQL (`payment_db`) o In-Memory Log.
* **Contrato:** JSON Schema propio (`payment-request.schema.json`).
* **Responsabilidades:**
  * Procesamiento simulado de tarjetas de crédito/pasarelas.
  * Inyección configurable de tasa de error (e.g., 20% de fallos inducidos) para probar la compensación de Sagas.
  * Emisión de eventos `pago.exitoso` y `pago.fallido` a CloudAMQP.

### 3.4. Microservicio BFF / GraphQL
* **Despliegue:** Azure Container Apps.
* **Contrato:** GraphQL Schema (`schema.gql` autogenerado code-first).
* **Responsabilidades:**
  * Agregación de datos del catálogo (REST) con stock en vivo (gRPC Railway).
  * Optimización de consumo de red para frontend.

---

## 4. Gobernanza de Contratos y Validación Schema-First

Para evitar la desincronización entre microservicios, todos los payloads JSON que no estén cubiertos por gRPC son validados en tiempo de ejecución mediante `ajv` y JSON Schemas declarativos.

### 4.1. Implementación del Pipe de Validación Universal (`JsonSchemaValidationPipe`)

```typescript
import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

@Injectable()
export class JsonSchemaValidationPipe implements PipeTransform {
  constructor(private readonly schema: object) {}

  transform(value: any) {
    const validate = ajv.compile(this.schema);
    const valid = validate(value);

    if (!valid) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'El payload de la petición viola el contrato JSON Schema establecido',
        errors: validate.errors?.map((err) => ({
          field: err.instancePath || 'root',
          message: err.message,
          rule: err.keyword,
        })),
      });
    }
    return value;
  }
}
```

---

## 5. Protocolo de Ahorro de Tokens para Agentes de IA (Copilot / Codex)

Para evitar el agotamiento de contexto y consumo innecesario de tokens al trabajar en VS Code, se establecen las siguientes reglas de comunicación con los agentes:

1. **Regla de Contexto Mínimo Requerido:**
   * Al solicitar código de un módulo, adjuntar **únicamente** la entidad, el DTO/Schema y la interfaz del servicio. No adjuntar proyectos enteros.
2. **Prompts Estructurados en Formato Declarativo:**
   * Usar estructuras breves con la firma exacta del método deseado.
   * *Ejemplo de prompt óptimo:*
     ```text
     @copilot Implementa la lógica de crearReserva en reserva.service.ts.
     Contrato: atracciones-openapi-v3.yaml (#/components/schemas/ReservaRequest).
     Base de Datos: Neon PostgreSQL vía TypeORM.
     Regla: Guardar reserva con estado 'PENDIENTE' y emitir evento a CloudAMQP usando AmqpConnection.
     ```
3. **Uso de Interfaces Generadas:**
   * Exportar tipos TypeScript directamente a un archivo centralizado `.d.ts` para que Copilot autocomplete sin requerir leer archivos YAML o Proto extensos.

---

## 6. Buenas Prácticas de Seguridad y Despliegue en la Nube

1. **Seguridad de Endpoints:**
   * **Autenticación/Autorización:** JWT para endpoints públicos/privados de clientes; API Keys seguras en cabeceras HTTP (`X-API-KEY`) para comunicación de microservicios REST.
   * **Protección HTTP:** `helmet()` habilitado en `main.ts` para mitigar ataques XSS y Clickjacking.
   * **Límite de Peticiones:** Rate limiting con `@nestjs/throttler` (e.g., máximo 100 req/min por IP).
   * **Sanitización:** `whitelist: true` y `additionalProperties: false` para bloquear Inyección de Propiedades.
2. **Conexión a Bases de Datos (Neon PostgreSQL):**
   * Usar pools de conexiones optimizados para entornos Serverless (`pg-bouncer` o cadenas con `sslmode=require`).
   * Mantener secrets (`DATABASE_URL`, `CLOUDAMQP_URL`) en variables de entorno y Azure Key Vault / Railway Variables.
3. **Estrategia de Despliegue:**
   * **Dockerfile Multietapa:** Construcción liviana basada en `node:20-alpine` para minimizar la imagen del contenedor.
   * **Variables de Entorno OBLIGATORIAS:**
     * `NODE_ENV=production`
     * `DATABASE_URL=postgres://user:pass@ep-cool-name.neon.tech/dbname?sslmode=require`
     * `CLOUDAMQP_URL=amqps://user:pass@monkey.rmq.cloudamqp.com/vhost`
     * `INVENTORY_GRPC_URL=inventory-production.up.railway.app:50051`