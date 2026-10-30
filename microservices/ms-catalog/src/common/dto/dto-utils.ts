export function resolveValue<T = unknown>(
  value: unknown,
  obj: unknown,
  ...aliases: string[]
): T | undefined {
  if (value !== undefined) return value as T;
  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>;
    for (const alias of aliases) {
      if (record[alias] !== undefined) {
        return record[alias] as T;
      }
    }
  }
  return undefined;
}

export function resolveTrimmedString(
  value: unknown,
  obj: unknown,
  ...aliases: string[]
): unknown {
  const raw = resolveValue<unknown>(value, obj, ...aliases);
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw).trim();
  }
  return raw;
}

export function resolveUpperString(
  value: unknown,
  obj: unknown,
  ...aliases: string[]
): unknown {
  const raw = resolveTrimmedString(value, obj, ...aliases);
  return typeof raw === 'string' ? raw.toUpperCase() : raw;
}

export function resolveLowerString(
  value: unknown,
  obj: unknown,
  ...aliases: string[]
): unknown {
  const raw = resolveTrimmedString(value, obj, ...aliases);
  return typeof raw === 'string' ? raw.toLowerCase() : raw;
}

export function resolveNumber(
  value: unknown,
  obj: unknown,
  ...aliases: string[]
): number | undefined {
  const raw = resolveValue<unknown>(value, obj, ...aliases);
  if (raw === undefined || raw === null || raw === '') return undefined;
  // Invalid supplied values must reach class-validator instead of becoming absent.
  if (typeof raw !== 'number' && typeof raw !== 'string') return Number.NaN;
  return Number(raw);
}

export function resolveBoolean(
  value: unknown,
  obj: unknown,
  ...aliases: string[]
): unknown {
  const raw = resolveValue<unknown>(value, obj, ...aliases);
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true' || raw === '1' || raw === 1) return true;
  if (raw === 'false' || raw === '0' || raw === 0) return false;
  return raw;
}

export function resolveNumberArray(
  value: unknown,
  obj: unknown,
  ...aliases: string[]
): unknown {
  const raw = resolveValue<unknown>(value, obj, ...aliases);
  if (!Array.isArray(raw)) return raw;
  return raw.map((item: unknown) =>
    typeof item === 'number' || typeof item === 'string'
      ? Number(item)
      : Number.NaN,
  );
}
