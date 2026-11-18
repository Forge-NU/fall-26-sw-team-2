import { Palette } from './palette';

// The native map's own colors (land, roads, parks, water) for the Google map
// style in components/explore/map-style.ts. The map takes them as hex strings.
// Roads and water use the palette; the rest are tints that only exist on the map.
export const MapStyleColors = {
  land: '#F2EFE8',
  label: '#6E7B76',
  labelHalo: '#F7F5F0',
  countryBorder: '#B8C4BD',
  provinceBorder: '#D3D9D3',
  neighborhoodLabel: '#7D8883',
  manMade: '#E9E5DC',
  natural: '#EFEDE4',
  park: '#D2E2C5',
  road: Palette.white,
  roadEdge: '#E5DFD3',
  highway: '#FBF6EA',
  highwayEdge: '#DDD2BC',
  transitLine: '#D9B99B',
  water: Palette.lightTeal,
  waterLabel: '#6C9893',
} as const;

// Sizes on the map tab (#81) that aren't on the spacing scale
export const MapTokens = {
  // Height of the panel's drag area around the handle
  handleZone: 28,
  // Zoom and locate buttons
  controlSize: 52,
  // Place detail: the big average rating, its bars and the photo strip
  ratingWidth: 76,
  ratingSize: 44,
  ratingLineHeight: 48,
  barHeight: 6,
  photo: { width: 160, height: 108 },
  // Rating pins are drawn into a fixed frame, so their text sizes are fixed too
  pin: {
    reviewsSize: 11,
    ratingSize: 15,
    // Busier places get bigger numbers, up to ratingSize + ratingGrowth
    ratingGrowth: 5,
    calloutLineHeight: 21,
    // Keeps pin labels readable over busy map tiles (warm white, nearly opaque)
    halo: 'rgba(255, 252, 250, 0.95)',
  },
} as const;
