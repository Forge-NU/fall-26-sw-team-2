import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Palette, Radius, ScreenGutter } from '@/constants/theme';
import type { Moment, TripDay } from '@/data/mock';

function countLabel(moments: Moment[]) {
  const photos = moments.filter((moment) => moment.kind === 'photo').length;
  const videos = moments.length - photos;
  const parts = [`${photos} photo${photos === 1 ? '' : 's'}`];
  if (videos > 0) parts.push(`${videos} video${videos === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** "Day N in moments": a lead photo followed by a two-column grid. */
export function DayMoments({ day }: { day: TripDay }) {
  const [lead, ...rest] = day.moments;
  const rows: Moment[][] = [];
  for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));

  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <AppText variant="bold" size={18}>
          Day {day.day} in moments
        </AppText>
        <AppText size={11} color="inkMuted">
          {countLabel(day.moments)}
        </AppText>
      </View>

      {lead && (
        <View style={styles.lead}>
          <Image source={lead.image} style={styles.leadImage} contentFit="cover" />
          <View style={styles.leadCaption}>
            {lead.title && (
              <AppText variant="bold" size={14}>
                {lead.title}
              </AppText>
            )}
            <AppText size={11} color="inkMuted">
              {lead.caption}
            </AppText>
          </View>
        </View>
      )}

      {rows.map((row) => (
        <View key={row[0].id} style={styles.row}>
          {row.map((moment) => (
            <View key={moment.id} style={styles.moment}>
              <View style={styles.thumb}>
                <Image source={moment.image} style={StyleSheet.absoluteFill} contentFit="cover" />
                {moment.kind === 'video' && (
                  <>
                    <View style={styles.play}>
                      <Icon name="play" />
                    </View>
                    {moment.duration && (
                      <View style={styles.duration}>
                        <AppText variant="semibold" size={10} color="surface">
                          {moment.duration}
                        </AppText>
                      </View>
                    )}
                  </>
                )}
              </View>
              <AppText size={11} color="inkMuted" leading={1.3}>
                {moment.caption}
              </AppText>
            </View>
          ))}
          {/* Keep a lone moment at half width. */}
          {row.length === 1 && <View style={styles.moment} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
    paddingHorizontal: ScreenGutter,
    paddingBottom: 16,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lead: {
    gap: 8,
  },
  leadImage: {
    height: 220,
    borderRadius: Radius.md,
  },
  leadCaption: {
    gap: 3,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  moment: {
    flex: 1,
    gap: 7,
  },
  thumb: {
    height: 120,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  play: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 36,
    height: 36,
    marginTop: -18,
    marginLeft: -18,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22, 42, 42, 0.5)',
  },
  duration: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: Palette.ink,
  },
});
