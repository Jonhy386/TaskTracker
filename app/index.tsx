import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ElapsedTime } from '../components/ElapsedTime';
import { formatDuration, formatDueDate } from '../lib/format';
import { getRunningSession, listProjects, listTasks } from '../lib/queries';
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [running, setRunning] = useState<TimeSession | null>(null);
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | null>(null);

  const reload = useCallback(async () => {
    const [taskRows, projectRows, runningSession] = await Promise.all([
      listTasks(db, {
        projectId: projectFilter ?? undefined,
        status: statusFilter ?? undefined,
      }),
      listProjects(db),
      getRunningSession(db),
    ]);
    setTasks(taskRows);
    setProjects(projectRows);
    setRunning(runningSession);
  }, [db, projectFilter, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push('/calendar')} hitSlop={8}>
                <Text style={styles.headerButtonText}>📅</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/reports')} hitSlop={8}>
                <Text style={styles.headerButtonText}>📊</Text>
              </Pressable>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push('/needs-review')} hitSlop={8}>
                <Text style={styles.headerButtonText}>📋</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/settings')} hitSlop={8}>
                <Text style={styles.headerButtonText}>⚙️</Text>
              </Pressable>
            </View>
          ),
        }}
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
          );
        }}
      />

      <View style={[styles.fabRow, { bottom: 24 + insets.bottom }]}>
        <Pressable style={styles.fab} onPress={() => router.push('/new-task')}>
          <Text style={styles.fabTextBold}>＋</Text>
        </Pressable>
        <Pressable style={styles.fab} onPress={() => router.push('/new-task-ai')}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerButtons: { flexDirection: 'row', gap: 16, paddingHorizontal: 8 },
  headerButtonText: { fontSize: 18 },
  headerButtonTextBold: { fontSize: 22, fontWeight: '600' },
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
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  fabText: { fontSize: 24 },
  fabTextBold: { fontSize: 28, fontWeight: '600', color: '#fff' },
  filterRow: { flexGrow: 0, paddingHorizontal: 12, paddingTop: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F1F1',
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#111' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  listContent: { padding: 12, gap: 8 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999' },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#F8F8F8',
    marginBottom: 8,
    gap: 10,
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '600' },
  taskMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  runningBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  runningDot: { color: '#E11D48', fontSize: 10 },
  runningText: { fontSize: 13, fontWeight: '600', color: '#E11D48' },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#EEE',
  },
  statusBadgeText: { fontSize: 11, color: '#555' },
});
