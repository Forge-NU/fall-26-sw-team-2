import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  Bookmark,
  Calendar,
  CalendarDays,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  Ellipsis,
  Heart,
  House,
  Images,
  Map,
  MapPin,
  MessageCircle,
  Music,
  Pencil,
  Play,
  Plus,
  Route,
  Search,
  Share,
  Share2,
  Sparkle,
  Trophy,
  Type,
  UserRound,
  X,
} from 'lucide-react-native';

import { Palette, PaletteColor } from '@/constants/theme';

// Lucide is the icon set the Figma wireframes use, so names match the design layers.
const Icons = {
  'arrow-right': ArrowRight,
  'arrow-up-right': ArrowUpRight,
  'badge-check': BadgeCheck,
  bell: Bell,
  bookmark: Bookmark,
  calendar: Calendar,
  'calendar-days': CalendarDays,
  camera: Camera,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-minus': CircleMinus,
  ellipsis: Ellipsis,
  heart: Heart,
  house: House,
  images: Images,
  map: Map,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  music: Music,
  pencil: Pencil,
  play: Play,
  plus: Plus,
  route: Route,
  search: Search,
  share: Share,
  'share-2': Share2,
  sparkle: Sparkle,
  trophy: Trophy,
  type: Type,
  'user-round': UserRound,
  x: X,
} as const;

export type IconName = keyof typeof Icons;

type IconProps = {
  name: IconName;
  size?: number;
  color?: PaletteColor;
};

export function Icon({ name, size = 18, color = 'ink' }: IconProps) {
  const LucideIcon = Icons[name];
  // The wireframes draw every icon with a 1.8px stroke regardless of size.
  return <LucideIcon size={size} color={Palette[color]} strokeWidth={1.8} absoluteStrokeWidth />;
}
