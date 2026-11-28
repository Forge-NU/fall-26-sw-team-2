import { ContentTokens } from './content-tokens';

// StarRating (RATE-2 #92). Sizes are star glyph sizes in points.
export const RatingTokens = {
  sizes: {
    small: 12, // trip page rows, cards, search results
    medium: 16, // post detail (#43 POST-3)
    large: 28, // the rating input
  },
  /** Space between stars in a display */
  gap: 2,
  /** Space between the stars and the "4.3 · 12" label */
  labelGap: 4,
  // Palette keys, not values: Icon and AppText take a key
  filledColor: 'coral500',
  emptyColor: 'coral500',
  labelColor: 'neutral500',
  /** Each star in the input is at least this big to tap */
  inputTarget: ContentTokens.actionSize,
  pressedOpacity: 0.7,
  disabledOpacity: ContentTokens.disabledOpacity,
} as const;

export type RatingSize = keyof typeof RatingTokens.sizes;
