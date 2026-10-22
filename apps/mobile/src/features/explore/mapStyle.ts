import type { MapStyleElement } from 'react-native-maps';

// Matches the wireframe: cream land, white streets, sage parks, pale teal water,
// business POIs hidden. Applies to Google maps (always on Android; on iOS only with
// PROVIDER_GOOGLE in a development build). Expo Go on iOS shows Apple Maps instead.
export const mapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#F2EFE8' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6E7B76' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F7F5F0' }, { weight: 3 }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#B8C4BD' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#D3D9D3' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#7D8883' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#E9E5DC' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#EFEDE4' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'on' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#D2E2C5' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#E5DFD3' }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: '#FBF6EA' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#DDD2BC' }] },
  { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit.line', elementType: 'geometry', stylers: [{ color: '#D9B99B' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C4DDD9' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6C9893' }] },
];
