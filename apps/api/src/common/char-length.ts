import { ValidationOptions, registerDecorator } from 'class-validator';

// Length check that counts characters the way Postgres does for VARCHAR(n)
// (Unicode code points). class-validator's Length/MaxLength skip emoji
// variation selectors, so "❤️" passes as 1 character but is 2 in Postgres,
// and a string at the limit fails the insert with a 500.
export function CharLength(
  min: number,
  max: number,
  options?: ValidationOptions,
) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'charLength',
      target: object.constructor,
      propertyName,
      constraints: [min, max],
      options: {
        message:
          min > 0
            ? `${propertyName} must be ${min} to ${max} characters`
            : `${propertyName} must be at most ${max} characters`,
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const length = [...value].length;
          return length >= min && length <= max;
        },
      },
    });
  };
}
