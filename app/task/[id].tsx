import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ElapsedTime } from '../../components/ElapsedTime';
import {
  formatDateDMY,
  formatDateTimeDMY,
  formatDuration,
  formatDueDate,
  formatTimeOnly,
} from '../../lib/format';
import {
  deleteTask,
  getRunningSession,
  getTask,
  listProjects,
  listSessionsForTask,
  markTaskDone,
  startTimer,
  stopTimer,
  updateTask,
} from '../../lib/queries';
import type { Project, Task, TimeSession } from '../../lib/types';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [running, setRunning] = useState<TimeSession | null>(null);
  const [editing, setEditing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Draft fields, only used while editing
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);

  const reload = useCallback(async () => {
    const [taskRow, projectRows, sessionRows, runningSession] = await Promise.all([
      getTask(db, id),
      listProjects(db),
      listSessionsForTask(db, id),
      getRunningSession(db),
    ]);
    setTask(taskRow);
    setProjects(projectRows);
    setSessions(sessionRows);
    setRunning(runningSession);
    if (taskRow) {
      setTitle(taskRow.title);
      setDescription(taskRow.description ?? '');
      setProjectId(taskRow.project_id);
      setDueDate(taskRow.due_date ? parseDateString(taskRow.due_date) : null);
    }
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  if (!task) {
    return (
      <View style={styles.container}>
        <Text>Loading…</Text>
      </View>
    );
  }

  const project = projects.find((p) => p.id === task.project_id);
  const isRunning = running?.task_id === task.id;

  async function handleStartStop() {
    if (isRunning && running) {
      await stopTimer(db, running.id);
    } else {
      await startTimer(db, task!.id);
    }
    reload();
  }

  async function handleMarkDone() {
    await markTaskDone(db, task!.id);
    reload();
  }

  async function handleDelete() {
    Alert.alert('Delete task?', 'This will also remove its tracked time sessions.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(db, task!.id);
          router.back();
        },
      },
    ]);
  }

  async function handleSaveEdits() {
    if (!title.trim() || !projectId) {
      Alert.alert('Missing fields', 'Title and project are required.');
      return;
    }
    await updateTask(db, task!.id, {
      title: title.trim(),
      description: description.trim() || null,
      project_id: projectId,
      due_date: dueDate ? toDateString(dueDate) : null,
    });
    setEditing(false);
    reload();
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => setEditing((e) => !e)} hitSlop={8}>
                <Text style={styles.headerButtonText}>{editing ? 'Cancel' : 'Edit'}</Text>
              </Pressable>
              <Pressable onPress={handleDelete} hitSlop={8}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          ),
        }}
      />

      {editing ? (
        <>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.label}>Project</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={projectId} onValueChange={setProjectId}>
              {projects.map((p) => (
                <Picker.Item key={p.id} label={p.name} value={p.id} />
              ))}
            </Picker>
          </View>

          <Text style={styles.label}>Due date</Text>
          <View style={styles.dueDateRow}>
            <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Text>{dueDate ? formatDateDMY(toDateString(dueDate)) : 'No due date'}</Text>
            </Pressable>
            {dueDate && (
              <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
            )}
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={dueDate ?? new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_e, selected) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selected) setDueDate(selected);
              }}
            />
          )}

          <Pressable style={styles.saveButton} onPress={handleSaveEdits}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.title}>{task.title}</Text>
          {task.description ? <Text style={styles.description}>{task.description}</Text> : null}

          <View style={styles.metaRow}>
            <View style={[styles.colorDot, { backgroundColor: project?.color ?? '#999' }]} />
            <Text style={styles.metaText}>{project?.name ?? 'Unknown project'}</Text>
          </View>
          {task.due_date && (
            <Text style={styles.metaText}>Due {formatDueDate(task.due_date)}</Text>
          )}
          <Text style={styles.metaText}>Status: {task.status.replace('_', ' ')}</Text>

          <View style={styles.timerBox}>
            {isRunning && running ? (
              <ElapsedTime startTime={running.start_time} style={styles.timerText} />
            ) : (
              <Text style={styles.timerText}>{formatDuration(task.total_time_seconds)}</Text>
            )}
            <Pressable
              style={[styles.timerButton, isRunning && styles.timerButtonRunning]}
              onPress={handleStartStop}
              disabled={task.status === 'cancelled'}
            >
              <Text style={styles.timerButtonText}>{isRunning ? 'Stop' : 'Start'}</Text>
            </Pressable>
          </View>

          {task.status !== 'done' && task.status !== 'cancelled' && (
            <Pressable style={styles.doneButton} onPress={handleMarkDone}>
              <Text style={styles.doneButtonText}>Mark as Done</Text>
            </Pressable>
          )}

          <Text style={styles.sectionTitle}>Time Sessions</Text>
          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>No sessions logged yet.</Text>
          ) : (
            sessions.map((s) => (
              <View key={s.id} style={styles.sessionRow}>
                <Text style={styles.sessionText}>
                  {formatDateTimeDMY(s.start_time)}
                  {s.end_time ? ` – ${formatTimeOnly(s.end_time)}` : ' – running'}
                </Text>
                <Text style={styles.sessionDuration}>
                  {s.duration_seconds != null ? formatDuration(s.duration_seconds) : '…'}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateString(s: string): Date {
  const [year, month, day] = s.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  headerButtons: { flexDirection: 'row', gap: 16 },
  headerButtonText: { fontSize: 15, color: '#111' },
  deleteText: { fontSize: 15, color: '#DC2626' },
  title: { fontSize: 22, fontWeight: '700' },
  description: { fontSize: 15, color: '#444', marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  metaText: { fontSize: 14, color: '#666', marginTop: 4 },
  timerBox: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8F8F8',
    alignItems: 'center',
    gap: 12,
  },
  timerText: { fontSize: 28, fontWeight: '700' },
  timerButton: {
    backgroundColor: '#111',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
  },
  timerButtonRunning: { backgroundColor: '#DC2626' },
  timerButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  doneButton: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneButtonText: { fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: '600', marginTop: 28, marginBottom: 8 },
  emptyText: { color: '#999', fontSize: 13 },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  sessionText: { fontSize: 13, color: '#444' },
  sessionDuration: { fontSize: 13, fontWeight: '600' },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  pickerWrap: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8 },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dateButton: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearText: { color: '#DC2626', fontSize: 13 },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
