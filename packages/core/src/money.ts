export const CURRENCY = 'GHS' as const;

/** Money is stored as integer pesewas to avoid floating-point rounding. */
export type Money = number & { readonly __brand: 'pesewas' };

export function pesewas(value: number): Money {
  if (!Number.isSafeInteger(value)) throw new Error('Money must be a safe integer number of pesewas');
  if (value < 0) throw new Error('Money cannot be negative');
  return value as Money;
}

export function fromGhs(value: number): Money {
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid GHS amount');
  const result = Math.round(value * 100);
  if (!Number.isSafeInteger(result)) throw new Error('Amount is too large');
  return result as Money;
}

export function toGhs(value: Money): number {
  return value / 100;
}

export function formatGhs(value: Money): string {
  return `GH₵${toGhs(value).toFixed(2)}`;
}
