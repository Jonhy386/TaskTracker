import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ElapsedTime } from '../components/ElapsedTime';
import { SwipeableRow } from '../components/SwipeableRow';
import { formatDuration, formatDueDate } from '../lib/format';
import { deleteTask, getRunningSession, listProjects, listTasks, stopTimer } from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Project, Task, TaskStatus, TimeSession } from '../lib/types';

const STATUS_FILTERS: { label: string; value: TaskStatus | null }[] = [
  { label: 'All', value: null },
  { label: 'Not started', value: 'not_started' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
  { label: 'Cancelled', value: 'cancelled' },
];

export default function TaskListScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [running, setRunning] = useState<TimeSession | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);
  const [search, setSearch] = useState('');

  const reload = useCallback(async () => {
    const [taskRows, projectRows, runningSession] = await Promise.all([
      listTasks(db, {
        projectId: projectFilter ?? undefined,
        status: statusFilter ?? undefined,
        search: search || undefined,
      }),
      listProjects(db),
      getRunningSession(db),
    ]);
    setTasks(taskRows);
    setProjects(projectRows);
    setRunning(runningSession);
  }, [db, projectFilter, statusFilter, search]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));

  function handleDelete(task: Task) {
    Alert.alert('Delete task?', `"${task.title}" and its tracked time will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTask(db, task.id);
          reload();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/menu')} hitSlop={8}>
              <Text style={styles.hamburgerText}>☰</Text>
            </Pressable>
          ),
        }}
      />

      {running && running.task_id === null && (
        <View style={styles.projectTimerBanner}>
          <Pressable style={styles.projectTimerInfo} onPress={() => router.push('/log-time')}>
            <Text style={styles.projectTimerText}>
              ⏱ {projectById.get(running.project_id)?.name ?? 'Project'} —{' '}
            </Text>
            <ElapsedTime startTime={running.start_time} style={styles.projectTimerText} />
          </Pressable>
          <Pressable
            style={styles.projectTimerStop}
            onPress={async () => {
              await stopTimer(db, running.id);
              reload();
            }}
          >
            <Text style={styles.projectTimerStopText}>Stop</Text>
          </Pressable>
        </View>
      )}

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="🔍 Search tasks"
        placeholderTextColor={c.textMuted}
        clearButtonMode="while-editing"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <FilterChip
          label="All projects"
          active={projectFilter === null}
          onPress={() => setProjectFilter(null)}
        />
        {projects.map((p) => (
          <FilterChip
            key={p.id}
            label={p.name}
            color={p.color}
            active={projectFilter === p.id}
            onPress={() => setProjectFilter(p.id)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <FilterChip
            key={f.label}
            label={f.label}
            active={statusFilter === f.value}
            onPress={() => setStatusFilter(f.value)}
          />
        ))}
      </ScrollView>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        ListEmptyComponent={<Text style={styles.emptyText}>No tasks yet.</Text>}
        renderItem={({ item }) => {
          const project = projectById.get(item.project_id);
          const isRunning = running?.task_id === item.id;
          return (
            <SwipeableRow onDelete={() => handleDelete(item)}>
              <Pressable
                style={styles.taskRow}
                onPress={() => router.push(`/task/${item.id}`)}
              >
                <View style={[styles.colorDot, { backgroundColor: project?.color ?? '#999' }]} />
                <View style={styles.taskInfo}>
                  <Text style={styles.taskTitle}>{item.title}</Text>
                  <Text style={styles.taskMeta}>
                    {project?.name ?? 'Unknown project'}
                    {item.due_date ? ` · ${formatDueDate(item.due_date)}` : ''}
                    {item.total_time_seconds > 0
                      ? ` · ${formatDuration(item.total_time_seconds)}`
                      : ''}
                  </Text>
                </View>
                {isRunning && running ? (
                  <View style={styles.runningBadge}>
                    <Text style={styles.runningDot}>●</Text>
                    <ElapsedTime startTime={running.start_time} style={styles.runningText} />
                  </View>
                ) : (
                  <StatusBadge status={item.status} />
                )}
              </Pressable>
            </SwipeableRow>
          );
        }}
      />

      <View style={[styles.fabRow, { bottom: 24 + insets.bottom }]}>
        <Pressable style={styles.fab} onPress={() => router.push('/new-task')}>
          <Text style={styles.fabTextBold}>＋</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => router.push('/capture')}>
          <Text style={styles.fabText}>🎤</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  color,
  onPress,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
}) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && styles.chipActive,
        color && active ? { backgroundColor: color } : null,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const labels: Record<TaskStatus, string> = {
    not_started: 'Not started',
    in_progress: 'In progress',
    done: 'Done',
    cancelled: 'Cancelled',
  };
  return (
    <View style={styles.statusBadge}>
      <Text style={styles.statusBadgeText}>{labels[status]}</Text>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    hamburgerText: { fontSize: 22, paddingHorizontal: 8, color: c.text },
    projectTimerBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginHorizontal: 12,
      marginTop: 8,
      padding: 12,
      borderRadius: 10,
      backgroundColor: c.warningBg,
    },
    projectTimerInfo: { flexDirection: 'row', flex: 1 },
    projectTimerText: { fontSize: 14, fontWeight: '600', color: c.warning },
    projectTimerStop: {
      backgroundColor: c.danger,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    projectTimerStopText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    searchInput: {
      marginHorizontal: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: c.text,
    },
    fabRow: {
      position: 'absolute',
      left: 24,
      right: 24,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    fab: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    fabText: { fontSize: 24 },
    fabTextBold: { fontSize: 28, fontWeight: '600', color: c.accentText },
    filterRow: { flexGrow: 0, paddingHorizontal: 12, paddingTop: 8 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
      marginRight: 8,
    },
    chipActive: { backgroundColor: c.accent },
    chipText: { fontSize: 13, color: c.text },
    chipTextActive: { color: c.accentText, fontWeight: '600' },
    listContent: { padding: 12, gap: 8 },
    emptyText: { textAlign: 'center', marginTop: 40, color: c.textMuted },
    taskRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      backgroundColor: c.surface,
      marginBottom: 8,
      gap: 10,
    },
    colorDot: { width: 10, height: 10, borderRadius: 5 },
    taskInfo: { flex: 1 },
    taskTitle: { fontSize: 16, fontWeight: '600', color: c.text },
    taskMeta: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    runningBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    runningDot: { color: '#E11D48', fontSize: 10 },
    runningText: { fontSize: 13, fontWeight: '600', color: '#E11D48' },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.surfaceAlt,
    },
    statusBadgeText: { fontSize: 11, color: c.textSecondary },
  });
}
