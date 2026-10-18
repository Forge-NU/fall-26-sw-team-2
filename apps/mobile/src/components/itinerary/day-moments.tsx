import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/icon';
import { Media } from '@/components/ui/media';
import { Palette, Radii, Spacing } from '@/constants/theme';
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
        <AppText variant="subheading">
          Day {day.day} in moments
        </AppText>
        <AppText variant="caption" color="placeholderGray">
          {countLabel(day.moments)}
        </AppText>
      </View>

      {lead && (
        <View style={styles.lead}>
          <Media seed={lead.id} url={lead.imageUrl} iconSize={36} style={styles.leadImage} />
          <View style={styles.leadCaption}>
            {lead.title && (
              <AppText variant="label">
                {lead.title}
              </AppText>
            )}
            <AppText variant="caption" color="placeholderGray">
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
                <Media seed={moment.id} url={moment.imageUrl} style={StyleSheet.absoluteFill} />
                {moment.kind === 'video' && (
                  <>
                    <View style={styles.play}>
                      <Icon name="play" size={16} color="warmWhite" />
                    </View>
                    {moment.duration && (
                      <View style={styles.duration}>
                        <AppText variant="caption" color="warmWhite">
                          {moment.duration}
                        </AppText>
                      </View>
                    )}
                  </>
                )}
              </View>
              <AppText variant="caption" color="placeholderGray">
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
    paddingHorizontal: Spacing.three,
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
    borderRadius: Radii.medium,
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
    borderRadius: Radii.small,
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
    borderRadius: Radii.circle,
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
    backgroundColor: Palette.black,
  },
});
