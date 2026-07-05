import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { formatDateTimeDMY } from '../lib/format';
import { listIdeas } from '../lib/queries';
import type { Idea } from '../lib/types';

export default function IdeasScreen() {
  const db = useSQLiteContext();
  const [ideas, setIdeas] = useState<Idea[]>([]);

  useFocusEffect(
    useCallback(() => {
      listIdeas(db).then(setIdeas);
    }, [db])
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={ideas}
      keyExtractor={(i) => i.id}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          No ideas saved yet — record or type one from the mic button.
        </Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.body}>{item.body}</Text>
          <Text style={styles.date}>{formatDateTimeDMY(item.created_at)}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999' },
  row: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F8F8F8',
    marginBottom: 12,
  },
  title: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 14, color: '#444', marginTop: 6, lineHeight: 20 },
  date: { fontSize: 12, color: '#999', marginTop: 8 },
});
