export function isValidIdempotencyKey(value: string | undefined): value is string {
  return Boolean(value && value.length <= 128 && /^[\x21-\x7e]+$/.test(value));
}
