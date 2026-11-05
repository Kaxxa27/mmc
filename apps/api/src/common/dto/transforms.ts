import type { TransformFnParams } from 'class-transformer';

/** `?ids=1,2` or `?ids=1&ids=2` -> [1, 2] (invalid entries become NaN and fail validation). */
export function toIntArray({ value }: TransformFnParams): unknown {
  if (value === undefined || value === null || value === '') return undefined;
  const parts: unknown[] = Array.isArray(value) ? value : String(value).split(',');
  return parts.map((part) => Number(String(part).trim()));
}

/** `?flag=true|false|1|0` -> boolean (anything else is left as-is and fails validation). */
export function toBoolean({ value }: TransformFnParams): unknown {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return value;
}

export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function toUpperCase({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim().toUpperCase() : value;
}

/** Empty strings become null (lets clients clear optional text fields). */
export function emptyToNull({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
