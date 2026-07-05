import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTimeDMY, formatDuration, formatTimeOnly } from '../lib/format';
import { assignSessionToTask, getSessionById, listTasks } from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Task, TimeSession } from '../lib/types';

export default function CategorizeSessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<TimeSession | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskId, setTaskId] = useState<string | null>(null);

  useEffect(() => {
    getSessionById(db, sessionId).then(async (row) => {
      setSession(row);
      if (row) {
        const taskRows = await listTasks(db, { projectId: row.project_id });
        const eligible = taskRows.filter((t) => t.status !== 'cancelled');
        setTasks(eligible);
        setTaskId(eligible[0]?.id ?? null);
      }
    });
  }, [db, sessionId]);

  async function handleSave() {
    if (!taskId) return;
    await assignSessionToTask(db, sessionId, taskId);
    router.back();
  }

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={{ color: c.text }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        {formatDateTimeDMY(session.start_time)}
        {session.end_time ? ` – ${formatTimeOnly(session.end_time)}` : ''}
        {session.duration_seconds != null ? ` · ${formatDuration(session.duration_seconds)}` : ''}
      </Text>

      <Text style={styles.label}>Assign to task</Text>
      {tasks.length === 0 ? (
        <Text style={styles.warning}>No tasks in this project yet — create one first.</Text>
      ) : (
        <View style={styles.pickerWrap}>
          <Picker selectedValue={taskId} onValueChange={setTaskId}>
            {tasks.map((t) => (
              <Picker.Item key={t.id} label={t.title} value={t.id} />
            ))}
          </Picker>
        </View>
      )}

      <Pressable
        style={[styles.saveButton, !taskId && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!taskId}
      >
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },
    hint: { fontSize: 13, color: c.textSecondary, marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginBottom: 6 },
    warning: { color: c.warning, fontSize: 14 },
    pickerWrap: { borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    saveButton: {
      marginTop: 24,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: c.accentText, fontWeight: '600', fontSize: 16 },
  });
}
