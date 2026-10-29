import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { dirname, join } from 'path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.GRPC,
      options: {
        package: 'pricing',
        protoPath: join(
          dirname(fileURLToPath(import.meta.url)),
          'pricing.proto',
        ),
        url: `0.0.0.0:${process.env.GRPC_PORT || 50051}`,
      },
    },
  );

  await app.listen();
  console.log(
    `Microservicio gRPC de pricing escuchando en 0.0.0.0:${process.env.GRPC_PORT || 50051}`,
  );
}

void bootstrap();
