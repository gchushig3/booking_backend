import { QueryFailedError } from 'typeorm';

export function isPostgresUniqueViolation(
  error: unknown,
): error is QueryFailedError {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === '23505'
  );
}
