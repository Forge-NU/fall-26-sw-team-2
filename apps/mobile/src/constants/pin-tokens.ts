import { Palette } from './palette';

// The drop-a-pin screen (#94 LOC-2)
export const PinTokens = {
  // The fixed pin in the middle of the map
  pinSize: 44,
  pinColor: Palette.coral,
  // Behind the pin, so it reads on any map color
  pinShadow: Palette.black,
  pinShadowOpacity: 0.25,
  pinShadowRadius: 4,
  mapBorder: Palette.peach,
} as const;
