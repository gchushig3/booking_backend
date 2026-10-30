import { Module } from '@nestjs/common';
import { UsersController, RolesController } from './users.controller.js';
import { UsersService } from './users.service.js';
@Module({
  controllers: [UsersController, RolesController],
  providers: [UsersService],
})
export class UsersModule {}
