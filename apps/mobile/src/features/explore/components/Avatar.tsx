import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

const TINTS = ['#DCE8DF', '#F6D9D0', '#D8E3EE', '#F1E4C4', '#E3DAEE'];

function tintFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  return (
    <View
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tintFor(id) }]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{name[0]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '600', color: colors.forest },
});
