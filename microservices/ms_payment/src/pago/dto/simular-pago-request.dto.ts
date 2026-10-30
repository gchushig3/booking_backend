import {
  IsIn,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  Validate,
} from 'class-validator';

const SIMULATION_RESULTS = ['APROBADO', 'RECHAZADO', 'FALLIDO'] as const;

@ValidatorConstraint({ name: 'simulationReasonMatchesResult', async: false })
class SimulationReasonMatchesResult implements ValidatorConstraintInterface {
  validate(value: unknown, validationArguments?: ValidationArguments): boolean {
    const request = validationArguments?.object as SimularPagoRequestDto;
    if (request.resultado === 'APROBADO') {
      return value === undefined;
    }

    return (
      typeof value === 'string' &&
      value.length >= 1 &&
      value.length <= 300 &&
      /\S/.test(value)
    );
  }

  defaultMessage(): string {
    return 'motivo is required for RECHAZADO/FALLIDO and forbidden for APROBADO';
  }
}

export class SimularPagoRequestDto {
  @IsIn(SIMULATION_RESULTS)
  resultado!: (typeof SIMULATION_RESULTS)[number];

  @Validate(SimulationReasonMatchesResult)
  motivo?: string;
}
