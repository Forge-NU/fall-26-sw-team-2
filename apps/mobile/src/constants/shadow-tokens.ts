import { Platform } from 'react-native';

import { Palette } from './palette';

// Soft drop shadow for things that float over the map: the search bar, cards,
// controls and the panel (#81). Android only supports elevation.
export const ShadowTokens = {
  floating:
    Platform.select({
      ios: {
        shadowColor: Palette.black,
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 4 },
      },
      default: { elevation: 6 },
    }) ?? {},
} as const;
