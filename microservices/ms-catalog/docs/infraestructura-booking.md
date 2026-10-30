# Integracion Booking

```text
src/booking/
  booking.module.ts                 # TypeORM, RabbitMqModule, proveedores
  booking-catalog.service.ts        # Filtros y proyecciones REST del YAML
  booking-profile.entity.ts         # Datos enriquecidos locales
  booking.schemas.ts                # AJV para administracion y perfil
  contract-schemas.ts               # Generado del contrato oficial
  inventory-availability.service.ts # Consulta gRPC a Railway
  catalog-events.service.ts         # atraccion.consultada con publisher confirms
```

1. Desde `../shared-infrastructure`: `npm ci` y `npm run build`. Desde este servicio: `npm ci`.
2. Configurar `.env` usando `.env.example`. `DATABASE_URL` habilita Neon con SSL forzado;
   sin URL se conserva PostgreSQL local para pruebas. No se activa DDL automatico.
3. Aplicar el SQL oficial en cada base y, sobre **ms_catalog**, ejecutar
   `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/booking-projection.sql`.
   Compose inicializa esta tabla solo al crear un volumen nuevo; en bases existentes aplicar el archivo.
4. Configurar Identity con la misma `BOOKING_API_KEY` y `IDENTITY_BASE_URL` terminado en `/api/v2`.
   Usar HTTPS o red privada para transmitir credenciales. El catalogo requiere access JWT,
   sesion vigente y rol **ADMIN** para administrar; API Key sola no concede permisos de usuario.
5. Crear la atraccion con `POST /api/v2/atracciones`, guardar sus datos de integracion con
   `PUT /api/v2/atracciones/{id}/booking` y publicarla mediante `PATCH .../{id}/estado`.
   Solo atracciones PUBLICADAS, no eliminadas y con perfil Booking aparecen en consultas publicas.

Ejemplo de cuerpo para `PUT .../{id}/booking` (datos reales del proveedor):

```json
{
  "city": "Quito",
  "price": {
    "currency": "USD",
    "adult": 20,
    "child": 10,
    "senior": 15,
    "infant": 0
  },
  "inclusions": {
    "includes_food": false,
    "includes_transport": true,
    "includes_guide": true
  },
  "itinerary": [],
  "ratings_breakdown": {
    "limpieza": 9,
    "servicio": 9,
    "calidad_precio": 8,
    "puntualidad": 9
  },
  "schedule_times": ["10:30:00"]
}
```

El SQL oficial no contiene ciudad textual, tarifas, desglose de resenas ni itinerario en
`atraccion`. El perfil guarda la proyeccion de esos datos, sincronizada por el administrador;
no se inventan precios ni se consultan otras bases. `horario` permanece en **ms_inventory**
y `tarifa` en **ms_pricing**. `schedule_times` es una copia de horarios activos de Inventory,
no la fuente de verdad del aforo. Renovar el perfil cuando cambien los datos del proveedor.
Las banderas de categoria se agregan desde los perfiles de sus atracciones publicadas.

REST publico implementado: `GET /atracciones`, `POST /atracciones/search`, `GET /atracciones/{id}`,
`GET /atracciones/categorias` y `GET /atracciones/categorias/arbol`, bajo `/api/v2`.
La respuesta de busqueda usa **metadata + data**, con limite maximo 50.
Se aplican filtros por ciudad, texto, categoria y descendientes, inclusiones, precio, idioma,
duracion, accesibilidad y cancelacion. Los filtros por fecha consultan aforo gRPC antes de paginar;
rango maximo operativo: 31 dias. La consulta es informativa y no reserva cupos.
El proto exige un slot conocido: se construye `slot-YYYYMMDD-HHMM` a partir de `schedule_times`.
`INVENTORY_SERVICE_ID` e ID publico UUID deben coincidir con los usados en la sincronizacion.
Sin horarios proyectados o ante fallo de Inventory, la busqueda por fecha responde 503.
La comprobacion actual recorre candidatos y slots; para catalogos grandes requiere un indice
de disponibilidad o una operacion de consulta masiva acordada con Inventory.

Cada detalle exitoso publica **atraccion.consultada** en `CATALOG_EVENTS_QUEUE`, conservando
`X-Correlation-Id`. Se espera publisher confirm; si CloudAMQP falla responde 503.
No se publican cambios administrativos en esta entrega; no se introduce una doble escritura
DB/evento. Los consumidores deben deduplicar por `eventoId`.

`npm run contracts:generate` extrae esquemas sin editar `contracts/`; `contracts:check` detecta
desfase. El YAML original contiene claves duplicadas en secciones ajenas al catalogo; cada
esquema utilizado aqui se analiza con claves unicas antes de generarse. El contrato completo
requiere corregir esas duplicaciones por su propietario, fuera del alcance autorizado.

Docker: desde la raiz del repositorio,
`docker build -f microservices/ms-catalog/Dockerfile -t ms-catalog .`.
Compose ya usa ese contexto e incluye el paquete compartido y el proto en el artefacto.
Para gRPC en el contenedor, usar `INVENTORY_PROTO_PATH=/app/contracts/inventory.proto`.
Las conexiones reales a Neon, CloudAMQP y Railway requieren variables operativas;
las pruebas automatizadas no utilizan credenciales ni servicios de nube.
