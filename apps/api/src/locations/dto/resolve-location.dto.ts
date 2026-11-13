import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidationArguments,
  registerDecorator,
} from 'class-validator';

const MAPBOX_FIELDS = [
  'mapboxId',
  'latitude',
  'longitude',
  'address',
  'city',
  'region',
  'countryCode',
] as const;

// A pin is a name and a point; the rest of the Mapbox fields are for places
const PIN_FIELDS = ['latitude', 'longitude'] as const;

// Kinds whose name follows the custom name rule. A pin uses the same rule as
// posts.custom_location_name, so picking "Drop a pin" or "Just the name"
// never changes which names are allowed.
const CUSTOM_NAME_KINDS: unknown[] = ['custom', 'pin'];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Optional text: trimmed, and blank becomes null so it's stored as NULL.
const trimOrNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

// Sanity caps for the TEXT columns, so a client can't store huge values in a
// shared row that's never deleted.
const MAX_NAME_LENGTH = 256;
const MAX_MAPBOX_ID_LENGTH = 256;
const MAX_ADDRESS_LENGTH = 512;
const MAX_AREA_NAME_LENGTH = 256;

// The Mapbox fields each kind doesn't take. Rejected rather than silently
// dropped: a custom location is only a name, and a pin is a name and a point.
function notAllowed(kind: unknown): readonly string[] {
  if (kind === 'custom') return MAPBOX_FIELDS;
  if (kind === 'pin') {
    return MAPBOX_FIELDS.filter(
      (field) => !(PIN_FIELDS as readonly string[]).includes(field),
    );
  }
  return [];
}

function OnlyFieldsForKind() {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'onlyFieldsForKind',
      target: object.constructor,
      propertyName,
      validator: {
        validate(kind: unknown, args: ValidationArguments) {
          const dto = args.object as Record<string, unknown>;
          return notAllowed(kind).every((field) => dto[field] === undefined);
        },
        defaultMessage: (args: ValidationArguments) => {
          const fields = notAllowed(args.value).join(', ');
          return args.value === 'pin'
            ? `pins only take a name, latitude and longitude; remove ${fields}`
            : `custom locations only take a name; remove ${fields}`;
        },
      },
    });
  };
}

// Matches posts.custom_location_name, VARCHAR(100). Mapbox names go in a
// TEXT column, so the cap only applies to custom names and pins.
// (@ValidateIf would skip every check on the property, not just this one.) Counts code points
// like Postgres VARCHAR does; class-validator's maxLength counts emoji such
// as '❤️' (two code points) as one.
const CUSTOM_NAME_MAX_LENGTH = 100;

function MaxLengthForCustomName(max: number) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxLengthForCustomName',
      target: object.constructor,
      propertyName,
      validator: {
        validate(name: unknown, args: ValidationArguments) {
          const dto = args.object as Record<string, unknown>;
          return (
            !CUSTOM_NAME_KINDS.includes(dto['kind']) ||
            (typeof name === 'string' && [...name].length <= max)
          );
        },
        defaultMessage: () =>
          `name must be shorter than or equal to ${max} characters`,
      },
    });
  };
}

const isMapbox = (dto: ResolveLocationDto) => dto.kind === 'mapbox';
const hasPoint = (dto: ResolveLocationDto) =>
  dto.kind === 'mapbox' || dto.kind === 'pin';

export class ResolveLocationDto {
  @IsIn(['mapbox', 'custom', 'pin'])
  @OnlyFieldsForKind()
  kind!: 'mapbox' | 'custom' | 'pin';

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  @MaxLengthForCustomName(CUSTOM_NAME_MAX_LENGTH)
  name!: string;

  @ValidateIf(isMapbox)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MAPBOX_ID_LENGTH)
  mapboxId?: string;

  @ValidateIf(hasPoint)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ValidateIf(hasPoint)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ADDRESS_LENGTH)
  address?: string | null;

  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AREA_NAME_LENGTH)
  city?: string | null;

  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_AREA_NAME_LENGTH)
  region?: string | null;

  // ISO 3166-1 alpha-2; Mapbox returns it lowercase
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @Matches(/^[A-Z]{2}$/)
  countryCode?: string;
}
