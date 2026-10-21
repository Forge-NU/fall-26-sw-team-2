import { validateSync } from 'class-validator';
import { CharLength } from './char-length';

class Example {
  @CharLength(1, 5)
  value: unknown;
}

function isValid(value: unknown) {
  const example = new Example();
  example.value = value;
  return validateSync(example).length === 0;
}

describe('CharLength', () => {
  it('counts characters the way Postgres does', () => {
    expect(isValid('abcde')).toBe(true);
    expect(isValid('abcdef')).toBe(false);
    // ❤️ is U+2764 plus the U+FE0F variation selector: 2 characters
    expect(isValid('❤️❤️')).toBe(true);
    expect(isValid('❤️❤️❤️')).toBe(false);
    // An emoji outside the BMP is one code point (two UTF-16 units)
    expect(isValid('😀😀😀😀😀')).toBe(true);
  });

  it('enforces the minimum and rejects non-strings', () => {
    expect(isValid('')).toBe(false);
    expect(isValid(12345)).toBe(false);
  });
});
