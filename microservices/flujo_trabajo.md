# Flujo de trabajo para crear microservicios REST

**Proyecto:** Sistema de Atracciones  
**Enfoque:** API-first, REST, NestJS, PostgreSQL, TypeORM, Swagger/OpenAPI, pruebas y despliegue  
**Documento:** `flujo_trabajo.md`  
**Base académica:** prácticas de las semanas 1, 2 y 3 de Integración de Sistemas.

> **Alcance y trazabilidad.** Las prácticas enseñan el desarrollo de una API de **Productos** con NestJS, primero en memoria y luego con PostgreSQL/TypeORM, además de CI y despliegue. Este documento conserva ese flujo y lo adapta a **varios microservicios REST** del Sistema de Atracciones. Las decisiones de separación de servicios, comunicación entre servicios, migraciones, observabilidad y seguridad reforzada son **recomendaciones de arquitectura complementarias**, no requisitos explícitos de las prácticas. El contrato `atracciones-openapi-v3.yaml` y el script `02_microservicios_v2_bases_de_datos.sql` deben considerarse fuentes de verdad para rutas, modelos y esquema concretos; **no se inventan aquí endpoints ni tablas de esos archivos**.

---

## 1. Tecnologías y herramientas

| Tecnología | Uso específico | Observación |
|---|---|---|
| **Node.js LTS** | Ejecutar los servicios | La práctica 3 comprueba Node >=18.19; su CI usa Node 22. Conviene unificar la versión en todo el equipo. |
| **npm** | Dependencias y scripts | Versionar `package-lock.json`; en CI ejecutar `npm ci`. |
| **TypeScript** | Lenguaje de implementación | Tipos en controladores, servicios, entidades y DTOs. |
| **NestJS** (`@nestjs/core`, `@nestjs/common`, `@nestjs/cli`) | Framework de cada microservicio REST | Módulos, controladores, servicios e inyección de dependencias. |
| **HTTP/JSON + REST** | Interfaz de comunicación | Recursos, URIs, verbos y códigos HTTP. |
| **OpenAPI + Swagger** (`@nestjs/swagger`) | Contrato y documentación interactiva | Contrato API-first y Swagger UI. |
| **class-validator / class-transformer** | Validar entradas | DTOs y `ValidationPipe`. |
| **PostgreSQL 16** | Base de datos relacional | En local mediante Docker. |
| **TypeORM** (`typeorm`, `@nestjs/typeorm`) | Persistencia ORM | Entidades y repositorios. |
| **pg** | Driver PostgreSQL | Requerido por TypeORM para PostgreSQL. |
| **@nestjs/config** | Variables de entorno | `DATABASE_URL`, `NODE_ENV`, `PORT`. |
| **Docker / Docker Desktop** | PostgreSQL local reproducible | Contenedores por servicio o instancias lógicamente aisladas. |
| **Git + GitHub** | Control de versiones | Commits, ramas y repositorios. |
| **GitHub Actions** | Integración continua | Build, pruebas unitarias y e2e con PostgreSQL. |
| **Render** | Despliegue | Web Service y PostgreSQL administrado; comprobar planes vigentes. |
| **Postman o Swagger UI** | Pruebas manuales HTTP | Verificar códigos, cuerpos y encabezados. |

**Paquetes de arranque** (por microservicio):

```bash
npm i @nestjs/swagger class-validator class-transformer
npm i @nestjs/typeorm typeorm pg @nestjs/config
```

**Recomendaciones complementarias:** `@nestjs/terminus` para health checks; Jest/Supertest para pruebas; ESLint/Prettier para calidad; migraciones TypeORM para cambios controlados en BD. Estas herramientas y prácticas adicionales no sustituyen los pasos exigidos en el laboratorio.

---

## 2. Antes de programar: definir los límites de cada microservicio

**Objetivo:** que cada servicio tenga una responsabilidad de negocio bien delimitada, su propio contrato REST y control sobre sus datos.

1. Enumerar las capacidades del Sistema de Atracciones (por ejemplo, las que realmente aparezcan en la arquitectura aprobada).
2. Para cada capacidad, identificar **qué microservicio es dueño** de cada entidad y operación. No duplicar escrituras de la misma entidad en varios servicios.
3. Revisar el contrato OpenAPI proporcionado por el equipo correspondiente; tomar de allí **rutas, métodos, parámetros, esquemas, respuestas y errores**. No modificarlo unilateralmente.
4. Revisar el script SQL compartido: identificar bases de datos, tablas, claves, restricciones y relaciones asignadas a cada servicio.
5. Documentar integraciones: qué servicio llama a cuál, con qué contrato, y qué hacer si el otro servicio no responde.
6. Definir nombres, puertos y variables de entorno **diferentes** para cada servicio. Ejemplo ilustrativo, no tomado del contrato: `booking-service` en `3001` y `atracciones-service` en `3002`.
7. Definir cómo versionar las APIs: preferentemente prefijo global `/api/v1` y controladores con rutas relativas. Evitar duplicar `/api/v1` en `main.ts` y en `@Controller()`.

**Entregable:** tabla de servicios y responsabilidades, contrato OpenAPI revisado, mapa de datos y dependencias.

| Campo a definir | Ejemplo de registro |
|---|---|
| Servicio | `<nombre-servicio>` |
| Responsabilidad | `<capacidad de negocio>` |
| Puerto local | `<puerto asignado>` |
| Base de datos | `<nombre definido en SQL>` |
| Entidades propias | `<tablas bajo su control>` |
| Contrato | `<archivo OpenAPI y versión>` |
| Dependencias externas | `<servicios consumidos>` |

**Verificación:** ninguna ruta ni entidad se ha supuesto sin contrastarla con el contrato y el SQL.

---

## 3. Paso 0 — Preparar el entorno

Comprobar:

```bash
node --version
npm --version
npm i -g @nestjs/cli
nest --version
docker --version
docker run hello-world
git --version
```

- Instalar **Node.js LTS**, Nest CLI, Git y Docker Desktop; mantener Docker ejecutándose.
- En macOS/Linux, si npm global devuelve `EACCES`, configurar un prefijo global de usuario; **no resolverlo usando `sudo npm i -g`**.
- Crear acceso a GitHub y Render si el despliegue será parte de la entrega.
- Confirmar que el puerto PostgreSQL 5432 y el puerto HTTP elegido no estén ocupados.

**Verificación:** Node, npm, Nest CLI, Docker y Git funcionan; `docker run hello-world` finaliza correctamente.

---

## 4. Paso 1 — Diseñar primero el contrato REST (API-first)

**Antes de implementar los controladores:**

1. Elegir el recurso y su nombre plural en la URI (`/productos` es el ejemplo de laboratorio; en el proyecto se usarán los recursos del contrato real).
2. Especificar para cada operación: método, URI, propósito, path/query params, request body, respuesta, encabezados y códigos de error.
3. Definir esquemas de entrada y salida por separado. Evitar exponer directamente campos internos de BD o secretos.
4. Acordar cómo se identifican los recursos y qué filtros/paginación se permiten.
5. Mantener coherencia de nombres y tipos con el OpenAPI y el SQL.
6. Revisar cambios del contrato con el equipo propietario antes de escribir código.

**Matriz REST de referencia del laboratorio:**

| Operación | Método y ruta | Respuesta esperada |
|---|---|---|
| Listar | `GET /api/v1/productos` | `200` + arreglo (incluso `[]`) |
| Obtener uno | `GET /api/v1/productos/:id` | `200` o `404` |
| Crear | `POST /api/v1/productos` | `201`, recurso creado y `Location` |
| Reemplazar | `PUT /api/v1/productos/:id` | `204` o `404` |
| Actualizar parcialmente | `PATCH /api/v1/productos/:id` | `200` o `404` |
| Eliminar | `DELETE /api/v1/productos/:id` | `204` o `404` |
| Filtrar | `GET /api/v1/productos?nombre=texto` | `200` + coincidencias |

**Importante:** son rutas **ilustrativas de Productos**, no rutas verificadas de Booking o Atracciones. Los códigos deben ajustarse al contrato vigente si este dispone algo distinto. La práctica 2 también aborda **HATEOAS** con `_links`: incorporarlo cuando lo requiera el contrato.

**Verificación:** todas las operaciones tienen ejemplos de petición/respuesta, validaciones y errores documentados.

---

## 5. Paso 2 — Crear el proyecto NestJS de cada servicio

Ejemplo para un servicio nuevo:

```bash
nest new nombre-servicio --package-manager npm
cd nombre-servicio
npm i @nestjs/swagger class-validator class-transformer
npm i @nestjs/typeorm typeorm pg @nestjs/config
npm run start:dev
```

Generar recursos (reemplazar `recurso` por el dominio real):

```bash
nest g module recurso
nest g controller recurso --no-spec
nest g service recurso --no-spec
```

**Estructura orientativa:**

```text
nombre-servicio/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   └── recurso/
│       ├── recurso.module.ts
│       ├── recurso.controller.ts
│       ├── recurso.service.ts
│       ├── recurso.entity.ts
│       └── dto/
│           ├── crear-recurso.dto.ts
│           └── actualizar-recurso.dto.ts
├── test/
├── .github/workflows/tests.yml
├── .env                 # NO versionar
├── .env.example         # SÍ versionar
├── .gitignore
├── package.json
└── README.md
```

**Responsabilidades:**
- **Controller:** recibe HTTP, extrae parámetros, aplica DTOs y responde.
- **Service:** implementa reglas de negocio, coordina operaciones y genera errores del dominio HTTP.
- **Entity:** mapea tablas y columnas de PostgreSQL.
- **DTO:** define y valida entradas; no es necesariamente igual a la entidad.
- **Module:** registra dependencias, controladores, servicios y repositorios.

**Verificación:** `npm run start:dev` inicia sin errores y la estructura está separada por responsabilidades.

---

## 6. Paso 3 — Configurar Swagger y validación global

Archivo `src/main.ts` (adaptación consistente con prefijo global):

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const config = new DocumentBuilder()
    .setTitle('API del microservicio')
    .setDescription('Contrato REST documentado con OpenAPI')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- Con este ejemplo Swagger UI está en **`/api/docs`**; las rutas de negocio en `/api/v1/...`.
- La práctica 3 usa alternativamente Swagger en **`/swagger`** y `@Controller('api/v1/productos')`; **son dos convenciones diferentes**. Elegir **una** por proyecto, no mezclarlas.
- Añadir `@ApiTags`, `@ApiOperation`, `@ApiParam`, `@ApiQuery`, `@ApiBody`, `@ApiResponse` y modelos Swagger donde corresponda.
- `@ApiResponse` debe documentar tanto éxitos como `400`, `404` y otros errores realmente previstos.
- Verificar que el documento generado coincide con el contrato API-first acordado; Swagger generado **no reemplaza** la revisión del contrato original.

**Verificación:** Swagger UI carga, expone los endpoints esperados y permite ejecutar peticiones.

---

## 7. Paso 4 — Levantar PostgreSQL con Docker

**Ejemplo del laboratorio para un solo servicio** (credenciales únicamente de desarrollo):

```bash
docker pull postgres:16
docker run --name pg-productos \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=productos_db \
  -p 5432:5432 \
  -d postgres:16

docker ps
docker exec -it pg-productos psql -U postgres -d productos_db -c '\dt'
```

- En el Sistema de Atracciones, crear la base de datos **que corresponda al servicio según el SQL aprobado**.
- Si hay varios contenedores PostgreSQL, asignar distintos puertos del host (por ejemplo, `5432:5432`, `5433:5432`), nombres y credenciales.
- Para desarrollo duradero, **recomendación complementaria:** usar volúmenes Docker; el ejemplo de la práctica conserva datos al reiniciar el contenedor, pero no garantiza conservarlos si este se elimina.
- No utilizar `postgres/postgres` fuera de un entorno académico aislado.

**Verificación:** el contenedor está `Up` y `psql` se conecta a la base correcta.

---

## 8. Paso 5 — Configurar variables de entorno y TypeORM

Crear `.env` local (valores de ejemplo):

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/productos_db
NODE_ENV=development
PORT=3000
```

Crear `.env.example` sin secretos reales:

```dotenv
DATABASE_URL=postgresql://usuario:password@host:5432/nombre_bd
NODE_ENV=development
PORT=3000
```

En `src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecursoModule } from './recurso/recurso.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') === 'development',
      }),
    }),
    RecursoModule,
  ],
})
export class AppModule {}
```

**Distinción crítica respecto de la práctica:** la práctica 3 configura `synchronize: true` incluso en Render para simplificar el laboratorio y advierte que **no debe hacerse así en producción real**. En un proyecto con el script SQL predefinido, validar primero quién crea las tablas; **no habilitar sincronización automática sobre un esquema existente sin autorización**. Para entornos compartidos y producción, usar **migraciones versionadas** o el mecanismo de despliegue de esquema acordado.

- No subir `.env` al repositorio.
- En Render configurar la URL real de PostgreSQL como variable de entorno.
- La práctica muestra `ssl: { rejectUnauthorized: false }` para producción; esto es una **simplificación del laboratorio**. En producción, verificar las exigencias de TLS del proveedor y usar validación de certificados cuando corresponda.

**Verificación:** la aplicación inicia sin errores de conexión y usa la base prevista.

---

## 9. Paso 6 — Definir entidades según el esquema aprobado

**Ejemplo académico de Productos:**

```ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('productos')
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nombre: string;

  @Column('numeric', {
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  precio: number;
}
```

**Al adaptarlo al proyecto:**
1. Comprobar nombre exacto de tabla, columnas, tipos, nulabilidad, índices y claves en el script SQL.
2. Mapear cada campo con `@Column`, claves con `@PrimaryGeneratedColumn` o el decorador apropiado, y relaciones solo cuando pertenezcan al mismo límite de datos.
3. No crear relaciones ORM directas entre bases de datos pertenecientes a servicios distintos; integrar por APIs y referencias de identificador.
4. Revisar tratamiento de `numeric/decimal`: PostgreSQL suele devolver cadenas para evitar pérdida de precisión. El `parseFloat` del laboratorio es didáctico; para importes monetarios reales evaluar precisión decimal estricta.
5. Registrar la entidad en su módulo:

```ts
@Module({
  imports: [TypeOrmModule.forFeature([Producto])],
  controllers: [ProductosController],
  providers: [ProductosService],
})
export class ProductosModule {}
```

**Verificación:** la entidad coincide con la BD y el repositorio se inyecta correctamente.

---

## 10. Paso 7 — Implementar DTOs y reglas de validación

Ejemplo de creación:

```ts
import { IsNotEmpty, IsNumber, IsPositive, IsString } from 'class-validator';

export class CrearProductoDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsNumber()
  @IsPositive()
  precio: number;
}
```

Ejemplo de actualización parcial:

```ts
import { IsNumber, IsPositive } from 'class-validator';

export class ActualizarPrecioDto {
  @IsNumber()
  @IsPositive()
  precio: number;
}
```

- Definir DTOs de **creación**, **reemplazo** y **actualización parcial** según los esquemas reales.
- Usar `whitelist`, `forbidNonWhitelisted` y `transform` globalmente.
- Validar tipos, rangos, obligatoriedad y formatos; probar datos inválidos para obtener `400`.
- Aplicar reglas de negocio en servicios, no solo decoradores de DTO.
- Documentar los DTOs y respuestas en Swagger.

**Verificación:** entradas válidas pasan y entradas mal formadas o con campos extra se rechazan de forma controlada.

---

## 11. Paso 8 — Implementar el CRUD con Repository

### 11.1 Servicio: inyección y lectura

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Producto } from './producto.entity';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarPrecioDto } from './dto/actualizar-precio.dto';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly repo: Repository<Producto>,
  ) {}

  findAll(nombre?: string): Promise<Producto[]> {
    if (!nombre) return this.repo.find();
    return this.repo.find({ where: { nombre: ILike(`%${nombre}%`) } });
  }

  async findOne(id: number): Promise<Producto> {
    const producto = await this.repo.findOneBy({ id });
    if (!producto) throw new NotFoundException(`Producto ${id} no existe`);
    return producto;
  }

  async crear(dto: CrearProductoDto): Promise<Producto> {
    return this.repo.save(this.repo.create(dto));
  }

  async reemplazar(id: number, dto: CrearProductoDto): Promise<void> {
    const actual = await this.findOne(id);
    await this.repo.save({ ...actual, ...dto });
  }

  async actualizarPrecio(id: number, dto: ActualizarPrecioDto): Promise<Producto> {
    const actual = await this.findOne(id);
    actual.precio = dto.precio;
    return this.repo.save(actual);
  }

  async eliminar(id: number): Promise<void> {
    const resultado = await this.repo.delete(id);
    if (resultado.affected === 0) {
      throw new NotFoundException(`Producto ${id} no existe`);
    }
  }
}
```

**Qué hace cada operación:** `find()` lista, `findOneBy()` busca, `create()` construye una instancia, `save()` escribe en BD, `delete()` elimina e `ILike` filtra sin distinguir mayúsculas en PostgreSQL.

### 11.2 Controlador: HTTP y códigos de estado

```ts
import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, ParseIntPipe, Patch, Post, Put, Query, Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProductosService } from './productos.service';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { ActualizarPrecioDto } from './dto/actualizar-precio.dto';

@Controller('productos') // main.ts ya tiene prefijo global api/v1
export class ProductosController {
  constructor(private readonly service: ProductosService) {}

  @Get()
  listar(@Query('nombre') nombre?: string) {
    return this.service.findAll(nombre);
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async crear(
    @Body() dto: CrearProductoDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const nuevo = await this.service.crear(dto);
    res.setHeader('Location', `/api/v1/productos/${nuevo.id}`);
    return nuevo;
  }

  @Put(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reemplazar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CrearProductoDto,
  ) {
    await this.service.reemplazar(id, dto);
  }

  @Patch(':id')
  actualizarPrecio(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarPrecioDto,
  ) {
    return this.service.actualizarPrecio(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async eliminar(@Param('id', ParseIntPipe) id: number) {
    await this.service.eliminar(id);
  }
}
```

**Reglas importantes:**
- `GET` sobre colección vacía devuelve `200` y `[]`, no `404`.
- `GET /:id` inexistente devuelve `404` mediante `NotFoundException`.
- `POST` válido devuelve `201`, entidad creada y encabezado `Location`.
- `PUT` del laboratorio reemplaza el recurso completo y responde `204` sin cuerpo.
- `PATCH` modifica solo el campo enviado y responde `200` con el recurso actualizado.
- `DELETE` devuelve `204`; repetirlo sobre el mismo identificador devuelve `404` en esta práctica.
- `ParseIntPipe` rechaza IDs no numéricos con `400`.
- No devolver cuerpos en respuestas `204`.
- Implementar **solo** operaciones que el contrato del microservicio autorice.

**Verificación:** cada endpoint compila, aparece en Swagger y devuelve el estado correcto.

---

## 12. Paso 9 — Probar contra PostgreSQL, no solo contra la API

Ejecutar la siguiente secuencia **por cada recurso**:

| Caso | Acción | Resultado esperado |
|---|---|---|
| 1 | `GET` colección sin registros | `200`, `[]` |
| 2 | `GET` ID inexistente | `404` |
| 3 | `POST` cuerpo válido | `201`, `Location` |
| 4 | `POST` cuerpo inválido | `400` |
| 5 | `GET` ID creado | `200`, datos correctos |
| 6 | `PUT` cuerpo completo | `204`, datos reemplazados |
| 7 | `PATCH` campo parcial | `200`, datos actualizados |
| 8 | `PUT`/`PATCH` ID inexistente | `404` |
| 9 | `DELETE` existente | `204` |
| 10 | Repetir `DELETE` | `404` según laboratorio |
| 11 | Filtrar por nombre | `200`, coincidencias; sin filtro devuelve todos |
| 12 | Reiniciar NestJS y consultar | Los datos restantes **persisten** |

Comprobar directamente en la base:

```bash
docker exec -it pg-productos psql -U postgres -d productos_db \
  -c 'SELECT * FROM productos;'
```

**Prueba fundamental de la semana 3:** crear registros, detener NestJS con `Ctrl+C`, reiniciar con `npm run start:dev` y volver a ejecutar `GET`. Los registros deben permanecer porque viven en PostgreSQL, no en el arreglo del proceso Node.

**Para el Sistema de Atracciones:** ejecutar consultas SQL sobre **las tablas reales** del servicio, no necesariamente `productos`.

**Verificación:** todas las pruebas HTTP y de persistencia tienen evidencia (capturas, respuestas, logs o reporte automatizado).

---

## 13. Paso 10 — Integración entre microservicios (adaptación arquitectónica)

> Esta sección **amplía** las prácticas, que desarrollan una API individual. Debe ajustarse a la arquitectura aprobada del Sistema de Atracciones.

1. Definir quién es **proveedor** y quién es **consumidor** de cada endpoint.
2. Utilizar contratos OpenAPI versionados para integrar servicios; validar compatibilidad de esquemas y códigos.
3. Configurar URLs de servicios mediante variables de entorno (`OTRO_SERVICIO_URL`), nunca codificarlas en el código.
4. Establecer **timeouts**, manejo de errores de red y política de reintentos solo para operaciones seguras/idempotentes o diseñadas para ello.
5. No consultar directamente la base de datos de otro microservicio.
6. Evitar ciclos de llamadas síncronas; documentar dependencias y estados de fallo.
7. Si una operación de negocio abarca varios servicios, definir cómo manejar resultados parciales; no asumir transacciones SQL entre bases independientes.
8. Añadir identificadores de correlación en logs y pruebas de integración de los flujos completos.
9. Si hay gateway en la arquitectura aprobada, documentar enrutamiento, autenticación y versionado; **no agregar uno solo por costumbre**.

**Verificación:** las dependencias y fallos entre servicios están documentados y probados.

---

## 14. Paso 11 — Preparar el servicio para producción

1. Leer `PORT` desde entorno: `await app.listen(process.env.PORT ?? 3000)`.
2. Mantener `.env` fuera de Git; subir `.env.example`.
3. Confirmar que `.gitignore` excluye `.env`, `node_modules/` y `dist/`.
4. Compilar y arrancar:

```bash
npm run build
npm run start:prod
```

5. Verificar logs sin exponer credenciales.
6. Revisar CORS, límites de petición, autenticación/autorización y manejo consistente de excepciones **según el contrato y requisitos del sistema** (complemento de producción).
7. Desactivar `synchronize` en producción y aplicar estrategia aprobada de migraciones/esquema.
8. Añadir endpoint de salud y monitoreo si el entorno de despliegue lo exige (complemento recomendado).
9. Mantener configuración de conexión y secretos independientes por ambiente.

**Verificación:** compila, inicia con configuración de producción y no requiere secretos en el repositorio.

---

## 15. Paso 12 — Git, GitHub y CI con GitHub Actions

Subir el código:

```bash
git init
git add .
git commit -m 'feat: implementar microservicio REST con PostgreSQL'
git branch -M main
git remote add origin https://github.com/USUARIO/REPOSITORIO.git
git push -u origin main
```

Crear `.github/workflows/tests.yml`:

```yaml
name: Tests
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: productos_db
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/productos_db
      NODE_ENV: test
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Unit tests
        run: npm test
      - name: E2E tests
        run: npm run test:e2e
```

**Adaptar:** nombre de BD, versión Node, rutas, tests y servicios de BD a cada repositorio. El workflow del laboratorio **ejecuta** las pruebas, pero no proporciona por sí solo pruebas completas del CRUD: hay que implementarlas. Si `npm ci` falla, comprobar sincronización entre `package.json` y `package-lock.json`.

**Verificación:** Actions termina en verde en `main` y en las pull requests.

---

## 16. Paso 13 — Desplegar PostgreSQL y la API en Render

**Secuencia de la práctica:**

1. Crear PostgreSQL administrado en Render, según la disponibilidad y condiciones del plan vigente.
2. Obtener la **Internal Database URL** para un Web Service de la misma región cuando sea aplicable.
3. Crear un **Web Service** enlazado al repositorio GitHub.
4. Configurar:

| Parámetro | Valor del laboratorio |
|---|---|
| Build Command | `npm install --include=dev && npm run build` |
| Start Command | `npm run start:prod` |
| `DATABASE_URL` | URL interna de PostgreSQL del entorno |
| `NODE_ENV` | `production` |
| `PORT` | Leer el puerto suministrado por la plataforma |

5. El laboratorio usa `--include=dev` para que `@nestjs/cli` esté disponible durante la compilación. En una canalización más optimizada, separar build y dependencias de ejecución.
6. Revisar logs hasta confirmar el inicio de NestJS y la conexión a PostgreSQL.
7. Abrir Swagger en la ruta configurada: **`/api/docs` en esta guía** o **`/swagger` en el ejemplo original de la semana 3**.
8. Repetir las pruebas CRUD y de persistencia contra la URL pública.
9. Tener en cuenta posibles **cold starts** o límites de planes gratuitos, sujetos a cambios del proveedor.
10. En un despliegue de múltiples servicios, configurar por separado URLs internas, secretos, bases y permisos de acceso.

**Verificación:** servicio accesible públicamente, Swagger correcto, operaciones REST funcionales y datos almacenados en PostgreSQL del entorno.

---

## 17. Paso 14 — Documentación y entrega

Cada microservicio debe entregar:

- [ ] `README.md` con objetivo, responsabilidad y límites del servicio.
- [ ] Requisitos de Node, npm, Docker y PostgreSQL.
- [ ] Instrucciones de instalación, arranque y compilación.
- [ ] Archivo `.env.example` sin credenciales reales.
- [ ] Contrato OpenAPI versionado o referencia a su ubicación oficial.
- [ ] URL local de Swagger y URL del servicio desplegado.
- [ ] Matriz de endpoints, parámetros, DTOs, respuestas y errores.
- [ ] Evidencia de CRUD y validaciones `400`/`404`.
- [ ] Evidencia de persistencia tras reinicio.
- [ ] Evidencia de consulta SQL directa.
- [ ] Evidencia de GitHub Actions exitoso.
- [ ] Evidencia de despliegue y pruebas en Render.
- [ ] Bitácora de problemas, decisiones y soluciones.
- [ ] Declaración de uso de IA, cuando aplique, según las instrucciones de la práctica.

**Formato de declaración de IA del laboratorio:**

```text
### Declaración de uso de IA
- Herramienta(s):
- Nivel de uso:
- Qué se le pidió:
- Qué se modificó/verificó manualmente:
```

La práctica permite utilizar IA como borrador o revisor, pero requiere comprender las configuraciones y probar personalmente cada endpoint.

---

## 18. Checklist maestro por microservicio

### Diseño
- [ ] Responsabilidad única y límites de datos acordados.
- [ ] Contrato API-first revisado con el equipo dueño.
- [ ] Rutas, verbos, códigos y esquemas coinciden con OpenAPI.
- [ ] Entidades coinciden con el SQL oficial.

### Implementación
- [ ] Proyecto NestJS creado y organizado en módulos.
- [ ] Swagger UI y decoradores de documentación completos.
- [ ] `ValidationPipe` global habilitado.
- [ ] DTOs de creación y actualización implementados.
- [ ] PostgreSQL local funcionando en Docker.
- [ ] TypeORM configurado mediante variables de entorno.
- [ ] CRUD implementado mediante repositorios.
- [ ] Filtros y HATEOAS implementados si los exige el contrato.
- [ ] Errores `400` y `404` controlados; estados `200`/`201`/`204` correctos.

### Pruebas y persistencia
- [ ] Pruebas positivas y negativas ejecutadas.
- [ ] Datos verificados directamente en PostgreSQL.
- [ ] Persistencia confirmada tras reinicio de NestJS.
- [ ] Pruebas automatizadas unitarias y e2e implementadas.
- [ ] Integraciones entre servicios verificadas, si existen.

### Entrega
- [ ] `.env` excluido de Git; `.env.example` versionado.
- [ ] Compilación de producción exitosa.
- [ ] GitHub Actions en verde.
- [ ] Despliegue en Render operativo.
- [ ] README, contrato, bitácora y evidencias entregados.

---

## 19. Errores frecuentes y prevención

| Problema | Causa probable | Solución |
|---|---|---|
| `EACCES` al instalar Nest CLI | Permisos de npm global | Configurar prefijo de usuario; evitar `sudo`. |
| `Cannot connect to the Docker daemon` | Docker Desktop detenido | Abrir Docker Desktop. |
| `port is already allocated` | Puerto PostgreSQL ocupado | Cambiar mapeo, p. ej. `5433:5432`, y ajustar `DATABASE_URL`. |
| Nombre de contenedor ya usado | Contenedor creado previamente | Ejecutar `docker start <nombre>` si existe. |
| TypeORM no conecta | URL/credenciales/host/puerto erróneos | Comprobar `.env`, `docker ps`, logs y conexión con `psql`. |
| Tabla no existe | Esquema no aplicado o entidad no registrada | Revisar migraciones/SQL y `forFeature`/`autoLoadEntities`. |
| Ruta duplicada `/api/v1/api/v1/...` | Prefijo en `main.ts` y controlador | Elegir una sola convención. |
| `Duplicate function implementation` | Se agregó otro `findAll` en vez de reemplazarlo | Sustituir el método anterior. |
| `precio` aparece como string | `numeric` de PostgreSQL | Revisar transformación y precisión requerida. |
| `npm ci` falla | Lockfile desactualizado | Ejecutar `npm install`, versionar `package-lock.json`. |
| `nest: not found` en build | CLI omitido por dependencias de desarrollo | Instalar devDependencies durante build. |
| API devuelve 500 en recurso ausente | Error no controlado | Lanzar `NotFoundException` donde corresponda. |
| Datos desaparecen | Se guardaban en memoria o se eliminó contenedor sin volumen | Comprobar BD real y estrategia de persistencia. |
| Datos/columnas cambian inesperadamente | `synchronize: true` en esquema compartido | Desactivar sincronización y aplicar migraciones controladas. |

---

## 20. Orden recomendado de ejecución para el Sistema de Atracciones

```text
1. Revisar arquitectura + OpenAPI + SQL oficiales
                  ↓
2. Definir límites, propietarios de datos y dependencias
                  ↓
3. Preparar Node, NestJS, Docker, Git
                  ↓
4. Diseñar/validar contrato REST (API-first)
                  ↓
5. Crear proyecto NestJS y módulos
                  ↓
6. Configurar Swagger + DTOs + ValidationPipe
                  ↓
7. Levantar PostgreSQL y aplicar esquema acordado
                  ↓
8. Configurar TypeORM, entidades y repositorios
                  ↓
9. Implementar GET → POST → PUT/PATCH → DELETE → filtros
                  ↓
10. Probar HTTP, errores y SQL directo
                  ↓
11. Reiniciar NestJS y demostrar persistencia
                  ↓
12. Probar integraciones entre microservicios
                  ↓
13. Compilar, automatizar CI y subir a GitHub
                  ↓
14. Desplegar y verificar en Render
                  ↓
15. Documentar, evidenciar y entregar
```

**Criterio de finalización:** un microservicio no está terminado solo porque responde en Swagger. Debe respetar el contrato, validar entradas, usar la base correcta, manejar errores, superar pruebas, conservar datos tras reinicio, integrarse correctamente cuando corresponda y estar documentado.
