import { ButtonTokens } from "./button-tokens";

// Responsive adaptations; final card dimensions are pending design review.
export const ContentTokens = {
  maxCardWidth: 560,
  maxPhotoHeight: 360,
  photoAspectRatio: 4 / 3,
  minDayWidth: 96,
  actionSize: ButtonTokens.minHeight,
  disabledOpacity: ButtonTokens.disabledOpacity,
} as const;
