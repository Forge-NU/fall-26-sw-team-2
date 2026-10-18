import { Transform } from 'class-transformer';

// Trims string fields before validation, so "  " fails a min length of 1.
export function Trim() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
