import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { inventoryGrpcOptions, sagaRmqOptions } from '@booking/infrastructure';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
const config = app.get(ConfigService);
app.setGlobalPrefix('api/v2');
app.enableShutdownHooks();
app.connectMicroservice(inventoryGrpcOptions(config, true));
app.connectMicroservice(sagaRmqOptions(config, 'ms_inventory'));
await app.startAllMicroservices();
await app.listen(Number(config.get('PORT') ?? 3017), '0.0.0.0');
