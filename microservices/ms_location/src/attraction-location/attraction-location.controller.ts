import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import {
  bigintIdSchema,
  InfrastructureRoles,
  JsonSchemaValidationPipe,
  PublicInfrastructure,
} from '@booking/infrastructure';
import { attractionLocationSchema } from '../location.schemas.js';
import {
  AttractionLocationService,
  type AttractionLocationInput,
} from './attraction-location.service.js';

const idPipe = new JsonSchemaValidationPipe<string>(bigintIdSchema);

@Controller('locations/attractions')
export class AttractionLocationController {
  constructor(private readonly service: AttractionLocationService) {}

  @Get(':atrId')
  @PublicInfrastructure()
  get(@Param('atrId', idPipe) atrId: string) {
    return this.service.get(atrId);
  }

  @Put(':atrId')
  @InfrastructureRoles('ADMIN')
  upsert(
    @Param('atrId', idPipe) atrId: string,
    @Body(new JsonSchemaValidationPipe(attractionLocationSchema))
    body: AttractionLocationInput,
  ) {
    return this.service.upsert(atrId, body);
  }
}
