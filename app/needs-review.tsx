import { useFocusEffect, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTimeDMY } from '../lib/format';
import { listPendingCaptures, resolvePendingCapture } from '../lib/queries';
import type { PendingCapture } from '../lib/types';

const REASON_LABELS: Record<string, string> = {
  no_connection: 'No connection',
  api_error: 'API error',
  malformed_response: 'Malformed response',
};

export default function NeedsReviewScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [captures, setCaptures] = useState<PendingCapture[]>([]);

  const reload = useCallback(async () => {
    setCaptures(await listPendingCaptures(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  function handleRetry(capture: PendingCapture) {
    router.push({
      pathname: '/capture',
      params: capture.audio_uri
        ? {
            prefillAudioUri: encodeURIComponent(capture.audio_uri),
            pendingCaptureId: capture.id,
          }
        : {
            prefillText: encodeURIComponent(capture.raw_text),
            pendingCaptureId: capture.id,
          },
    });
  }

  function handleDiscard(capture: PendingCapture) {
    Alert.alert(
      'Discard this note?',
      capture.audio_uri ? 'This voice note will be deleted.' : capture.raw_text,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            if (capture.audio_uri) {
              await FileSystem.deleteAsync(capture.audio_uri, { idempotent: true }).catch(() => {});
            }
            await resolvePendingCapture(db, capture.id);
            reload();
          },
        },
      ]
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={captures}
      keyExtractor={(c) => c.id}
      ListEmptyComponent={
        <Text style={styles.emptyText}>Nothing here — every note parsed cleanly.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.rawText}>
            {item.audio_uri ? '🎤 Voice note' : item.raw_text}
          </Text>
          <Text style={styles.reasonText}>
            {REASON_LABELS[item.failure_reason] ?? item.failure_reason} ·{' '}
            {formatDateTimeDMY(item.created_at)}
          </Text>
          <View style={styles.actionsRow}>
            <Pressable style={styles.retryButton} onPress={() => handleRetry(item)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
            <Pressable style={styles.discardButton} onPress={() => handleDiscard(item)}>
              <Text style={styles.discardButtonText}>Discard</Text>
            </Pressable>
          </View>
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
  rawText: { fontSize: 15, color: '#111' },
  reasonText: { fontSize: 12, color: '#999', marginTop: 6 },
  actionsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  retryButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  discardButton: {
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  discardButtonText: { color: '#DC2626', fontWeight: '600', fontSize: 13 },
});
