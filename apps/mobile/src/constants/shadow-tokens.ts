import { Platform } from 'react-native';

import { Palette } from './palette';

// The one shadow, Floating: sheets and things that float over content, like
// the map's search bar and cards. Cards in lists stay flat. Android only
// supports elevation.
export const ShadowTokens = {
  floating:
    Platform.select({
      ios: {
        shadowColor: Palette.black,
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
      default: { elevation: 6 },
    }) ?? {},
} as const;
