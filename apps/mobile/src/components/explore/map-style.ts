import type { MapStyleElement } from 'react-native-maps';

import { MapStyleColors as c } from '@/constants/map-tokens';

// Matches the wireframe: cream land, white streets, sage parks, pale teal water,
// business POIs hidden. Applies to Google maps (always on Android; on iOS only with
// PROVIDER_GOOGLE in a development build). Expo Go on iOS shows Apple Maps instead.
export const mapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: c.land }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: c.label }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: c.labelHalo }, { weight: 3 }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: c.countryBorder }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: c.provinceBorder }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: c.neighborhoodLabel }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: c.manMade }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: c.natural }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: c.park }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: c.road }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: c.roadEdge }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: c.highway }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: c.highwayEdge }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: c.transitLine }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: c.water }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: c.waterLabel }] },
];
