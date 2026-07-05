import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listPendingCaptures } from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';

const ITEMS: {
  label: string;
  icon: string;
  route: '/' | '/tasks' | '/calendar' | '/reports' | '/ideas' | '/log-time' | '/needs-review' | '/settings';
}[] = [
  { label: 'Today', icon: '🏠', route: '/' },
  { label: 'Tasks', icon: '✅', route: '/tasks' },
  { label: 'Calendar', icon: '📅', route: '/calendar' },
  { label: 'Time Report', icon: '📊', route: '/reports' },
  { label: 'Log Time', icon: '⏱️', route: '/log-time' },
  { label: 'Ideas', icon: '💡', route: '/ideas' },
  { label: 'Needs Review', icon: '📋', route: '/needs-review' },
  { label: 'Settings', icon: '⚙️', route: '/settings' },
];

export default function MenuScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [pendingCount, setPendingCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      listPendingCaptures(db).then((rows) => setPendingCount(rows.length));
    }, [db])
  );

  return (
    <View style={styles.container}>
      {ITEMS.map((item) => (
        <Pressable
          key={item.route}
          style={styles.row}
          onPress={() => {
            router.back();
            router.push(item.route);
          }}
        >
          <Text style={styles.icon}>{item.icon}</Text>
          <Text style={styles.label}>
            {item.label}
            {item.route === '/needs-review' && pendingCount > 0 ? ` · ${pendingCount}` : ''}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, paddingTop: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 16,
    },
    icon: { fontSize: 20 },
    label: { fontSize: 16, fontWeight: '500', color: c.text },
  });
}
