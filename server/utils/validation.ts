export function isValidId(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  const trimmed = id.trim();
  return trimmed.length > 0 && trimmed.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(trimmed);
}

export function isValidDateString(dateStr: unknown): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !isNaN(Date.parse(dateStr));
}

export function isValidTimeString(timeStr: unknown): boolean {
  if (!timeStr || typeof timeStr !== 'string') return false;
  return /^\d{2}:\d{2}(:\d{2})?$/.test(timeStr);
}

export function sanitizeText(str: unknown, maxLen = 300): string {
  if (str === null || str === undefined) return '';
  const val = String(str).trim();
  return val.length > maxLen ? val.substring(0, maxLen) : val;
}

export function isValidEnum<T extends string>(val: unknown, allowed: readonly T[]): val is T {
  return typeof val === 'string' && allowed.includes(val as T);
}

export function sendError(res: any, statusCode: number, errorType: string, message: string): void {
  res.status(statusCode).json({
    error: errorType,
    message,
  });
}
