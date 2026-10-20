import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { Palette } from '@/constants/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

// App icon names mapped to Ionicons, the icon set UI-1 uses (Avatar, EmptyState).
// Names describe the meaning, so screens don't change if the icon set does.
const Icons = {
  'arrow-right': { glyph: 'arrow-forward' },
  // Ionicons has no plain diagonal arrow, so the forward arrow is turned 45°.
  'arrow-up-right': { glyph: 'arrow-forward', rotate: '-45deg' },
  'badge-check': { glyph: 'checkmark-circle-outline' },
  bell: { glyph: 'notifications-outline' },
  bookmark: { glyph: 'bookmark-outline' },
  calendar: { glyph: 'calendar-outline' },
  'calendar-days': { glyph: 'calendar-number-outline' },
  camera: { glyph: 'camera-outline' },
  check: { glyph: 'checkmark' },
  'chevron-down': { glyph: 'chevron-down' },
  'chevron-left': { glyph: 'chevron-back' },
  'chevron-right': { glyph: 'chevron-forward' },
  'circle-minus': { glyph: 'remove-circle-outline' },
  ellipsis: { glyph: 'ellipsis-horizontal' },
  heart: { glyph: 'heart-outline' },
  'heart-filled': { glyph: 'heart' },
  house: { glyph: 'home-outline' },
  image: { glyph: 'image-outline' },
  images: { glyph: 'images-outline' },
  map: { glyph: 'map-outline' },
  'map-pin': { glyph: 'location-outline' },
  'message-circle': { glyph: 'chatbubble-outline' },
  music: { glyph: 'musical-notes-outline' },
  pencil: { glyph: 'pencil-outline' },
  play: { glyph: 'play' },
  plus: { glyph: 'add' },
  route: { glyph: 'trail-sign-outline' },
  search: { glyph: 'search-outline' },
  share: { glyph: 'share-outline' },
  send: { glyph: 'paper-plane-outline' },
  'share-2': { glyph: 'share-social-outline' },
  sparkle: { glyph: 'sparkles-outline' },
  trophy: { glyph: 'trophy-outline' },
  type: { glyph: 'text-outline' },
  'user-round': { glyph: 'person-outline' },
  x: { glyph: 'close' },
} satisfies Record<string, { glyph: IoniconName; rotate?: string }>;

export type IconName = keyof typeof Icons;

type IconProps = {
  name: IconName;
  size?: number;
  color?: keyof typeof Palette;
};

export function Icon({ name, size = 18, color = 'black' }: IconProps) {
  const icon: { glyph: IoniconName; rotate?: string } = Icons[name];
  return (
    <Ionicons
      name={icon.glyph}
      size={size}
      color={Palette[color]}
      accessible={false}
      style={icon.rotate ? { transform: [{ rotate: icon.rotate }] } : undefined}
    />
  );
}
