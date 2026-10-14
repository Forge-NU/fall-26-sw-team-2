import { Image } from 'expo-image';
import { type StyleProp, type ImageStyle } from 'react-native';

// Icons exported from the Figma wireframes. Each SVG carries its own color and
// is rendered at its intrinsic size, so pick the variant that matches the design.
const Icons = {
  'arrow-right-white': { source: require('@/assets/images/yuji/icons/arrow-right-white.svg'), size: 17 },
  'arrow-up-right': { source: require('@/assets/images/yuji/icons/arrow-up-right.svg'), size: 18 },
  bell: { source: require('@/assets/images/yuji/icons/bell.svg'), size: 21 },
  bookmark: { source: require('@/assets/images/yuji/icons/bookmark.svg'), size: 22 },
  'cal-chevron-left': { source: require('@/assets/images/yuji/icons/cal-chevron-left.svg'), size: 18 },
  'cal-chevron-right': { source: require('@/assets/images/yuji/icons/cal-chevron-right.svg'), size: 18 },
  'calendar-coral': { source: require('@/assets/images/yuji/icons/calendar-coral.svg'), size: 16 },
  'calendar-days': { source: require('@/assets/images/yuji/icons/calendar-days.svg'), size: 19 },
  'calendar-days-22': { source: require('@/assets/images/yuji/icons/calendar-days-22.svg'), size: 22 },
  camera: { source: require('@/assets/images/yuji/icons/camera.svg'), size: 14 },
  'check-coral': { source: require('@/assets/images/yuji/icons/check-coral.svg'), size: 16 },
  'check-white': { source: require('@/assets/images/yuji/icons/check-white.svg'), size: 16 },
  'chevron-down': { source: require('@/assets/images/yuji/icons/chevron-down.svg'), size: 18 },
  'chevron-left': { source: require('@/assets/images/yuji/icons/chevron-left.svg'), size: 20 },
  'chevron-right': { source: require('@/assets/images/yuji/icons/chevron-right.svg'), size: 18 },
  'chevron-right-coral': { source: require('@/assets/images/yuji/icons/chevron-right-coral.svg'), size: 18 },
  'chevron-right-teal': { source: require('@/assets/images/yuji/icons/chevron-right-teal.svg'), size: 18 },
  'clear-14': { source: require('@/assets/images/yuji/icons/clear-14.svg'), size: 14 },
  'close-28': { source: require('@/assets/images/yuji/icons/close-28.svg'), size: 28 },
  comment: { source: require('@/assets/images/yuji/icons/comment.svg'), size: 22 },
  'create-trip': { source: require('@/assets/images/yuji/icons/create-trip.svg'), size: 32 },
  ellipsis: { source: require('@/assets/images/yuji/icons/ellipsis.svg'), size: 20 },
  heart: { source: require('@/assets/images/yuji/icons/heart.svg'), size: 22 },
  images: { source: require('@/assets/images/yuji/icons/images.svg'), size: 14 },
  'images-white': { source: require('@/assets/images/yuji/icons/images-white.svg'), size: 23 },
  'map-pin': { source: require('@/assets/images/yuji/icons/map-pin.svg'), size: 18 },
  'map-pin-coral': { source: require('@/assets/images/yuji/icons/map-pin-coral.svg'), size: 20 },
  'map-pin-dark': { source: require('@/assets/images/yuji/icons/map-pin-dark.svg'), size: 20 },
  'minus-circle': { source: require('@/assets/images/yuji/icons/minus-circle.svg'), size: 20 },
  music: { source: require('@/assets/images/yuji/icons/music.svg'), size: 17 },
  pencil: { source: require('@/assets/images/yuji/icons/pencil.svg'), size: 12 },
  play: { source: require('@/assets/images/yuji/icons/play.svg'), size: 16 },
  'plus-coral': { source: require('@/assets/images/yuji/icons/plus-coral.svg'), size: 13 },
  'plus-white': { source: require('@/assets/images/yuji/icons/plus-white.svg'), size: 18 },
  'radio-off': { source: require('@/assets/images/yuji/icons/radio-off.svg'), size: 18 },
  'radio-on': { source: require('@/assets/images/yuji/icons/radio-on.svg'), size: 18 },
  route: { source: require('@/assets/images/yuji/icons/route.svg'), size: 23 },
  search: { source: require('@/assets/images/yuji/icons/search.svg'), size: 18 },
  share: { source: require('@/assets/images/yuji/icons/share.svg'), size: 18.3348 },
  'share-coral': { source: require('@/assets/images/yuji/icons/share-coral.svg'), size: 22 },
  sparkle: { source: require('@/assets/images/yuji/icons/sparkle.svg'), size: 14 },
  'tab-feed-active': { source: require('@/assets/images/yuji/icons/tab-feed-active.svg'), size: 22 },
  'tab-maps': { source: require('@/assets/images/yuji/icons/tab-maps.svg'), size: 22 },
  'tab-post': { source: require('@/assets/images/yuji/icons/tab-post.svg'), size: 22 },
  'tab-profile': { source: require('@/assets/images/yuji/icons/tab-profile.svg'), size: 22 },
  trophy: { source: require('@/assets/images/yuji/icons/trophy.svg'), size: 19 },
  type: { source: require('@/assets/images/yuji/icons/type.svg'), size: 14 },
  verified: { source: require('@/assets/images/yuji/icons/verified.svg'), size: 13 },
  x: { source: require('@/assets/images/yuji/icons/x.svg'), size: 18 },
} as const;

export type IconName = keyof typeof Icons;

export function Icon({ name, style }: { name: IconName; style?: StyleProp<ImageStyle> }) {
  const { source, size } = Icons[name];
  return <Image source={source} style={[{ width: size, height: size }, style]} contentFit="contain" />;
}
