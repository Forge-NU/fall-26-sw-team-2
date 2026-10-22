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

// A custom location is only a name, so reject Mapbox fields sent with it
// instead of silently dropping them.
function NoMapboxFieldsWhenCustom() {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'noMapboxFieldsWhenCustom',
      target: object.constructor,
      propertyName,
      validator: {
        validate(kind: unknown, args: ValidationArguments) {
          if (kind !== 'custom') return true;
          const dto = args.object as Record<string, unknown>;
          return MAPBOX_FIELDS.every((field) => dto[field] === undefined);
        },
        defaultMessage: () =>
          `custom locations only take a name; remove ${MAPBOX_FIELDS.join(', ')}`,
      },
    });
  };
}

// Matches posts.custom_location_name, VARCHAR(100). Mapbox names go in a
// TEXT column, so the cap only applies to custom names. (@ValidateIf would
// skip every check on the property, not just this one.) Counts code points
// like Postgres VARCHAR does; class-validator's maxLength counts emoji such
// as '❤️' (two code points) as one.
const CUSTOM_NAME_MAX_LENGTH = 100;

function MaxLengthWhenCustom(max: number) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'maxLengthWhenCustom',
      target: object.constructor,
      propertyName,
      validator: {
        validate(name: unknown, args: ValidationArguments) {
          const dto = args.object as Record<string, unknown>;
          return (
            dto['kind'] !== 'custom' ||
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

export class ResolveLocationDto {
  @IsIn(['mapbox', 'custom'])
  @NoMapboxFieldsWhenCustom()
  kind!: 'mapbox' | 'custom';

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_NAME_LENGTH)
  @MaxLengthWhenCustom(CUSTOM_NAME_MAX_LENGTH)
  name!: string;

  @ValidateIf(isMapbox)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MAPBOX_ID_LENGTH)
  mapboxId?: string;

  @ValidateIf(isMapbox)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ValidateIf(isMapbox)
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
