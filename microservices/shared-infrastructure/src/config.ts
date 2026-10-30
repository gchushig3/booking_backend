import { ConfigService } from "@nestjs/config";

export function positiveInteger(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const value = Number(config.get(key) ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`Invalid ${key}`);
  return value;
}
