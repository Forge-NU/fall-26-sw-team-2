import { Screen } from '@/components/ui/screen';
import { YujiHeader } from '@/components/yuji-header';

/** react-native-maps has no web support, so the web build (and PR web preview) shows this instead. */
export default function ExploreScreen() {
  return (
    <Screen
      edges={['top']}
      gutters={false}
      header={<YujiHeader />}
      empty={{
        icon: 'map-outline',
        title: 'The map is in the phone app',
        description: 'Open Yuji on your phone to explore places on the map.',
      }}
    />
  );
}
