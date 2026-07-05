import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateDMY, formatDuration } from '../lib/format';
import { getTaskTimeForDay, listProjects, type TaskTimeForDay } from '../lib/queries';
import type { Project } from '../lib/types';

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

export default function ReportsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tasks, setTasks] = useState<TaskTimeForDay[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const dayString = toDateString(selectedDate);

  const reload = useCallback(async () => {
    const [taskRows, projectRows] = await Promise.all([
      getTaskTimeForDay(db, dayString),
      listProjects(db),
    ]);
    setTasks(taskRows);
    setProjects(projectRows);
  }, [db, dayString]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const totalSeconds = tasks.reduce((sum, t) => sum + t.total_seconds, 0);

  return (
    <View style={styles.container}>
      <View style={styles.dateNav}>
        <Pressable
          style={styles.navButton}
          onPress={() => setSelectedDate((d) => addDays(d, -1))}
        >
          <Text style={styles.navButtonText}>◀</Text>
        </Pressable>
        <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
          <Text style={styles.dateButtonText}>{formatDateDMY(dayString)}</Text>
        </Pressable>
        <Pressable style={styles.navButton} onPress={() => setSelectedDate((d) => addDays(d, 1))}>
          <Text style={styles.navButtonText}>▶</Text>
        </Pressable>
      </View>
      {dayString !== toDateString(new Date()) && (
        <Pressable style={styles.todayLink} onPress={() => setSelectedDate(new Date())}>
          <Text style={styles.todayLinkText}>Jump to today</Text>
        </Pressable>
      )}

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_e, selected) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selected) setSelectedDate(selected);
          }}
        />
      )}

      <Text style={styles.totalText}>
        Total: {tasks.length === 0 ? '0s' : formatDuration(totalSeconds)}
      </Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={tasks}
        keyExtractor={(t) => t.task_id ?? `uncategorized-${t.project_id}`}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No time tracked on this day.</Text>
        }
        renderItem={({ item }) => {
          const project = projectById.get(item.project_id);
          const isUncategorized = item.task_id === null;
          return (
            <Pressable
              style={styles.row}
              onPress={isUncategorized ? () => router.push('/log-time') : undefined}
            >
              <View style={[styles.colorDot, { backgroundColor: project?.color ?? '#999' }]} />
              <View style={styles.taskInfo}>
                <Text style={[styles.taskTitle, isUncategorized && styles.uncategorizedTitle]}>
                  {item.title}
                </Text>
                <Text style={styles.taskMeta}>{project?.name ?? 'Unknown project'}</Text>
              </View>
              <Text style={styles.durationText}>{formatDuration(item.total_seconds)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  navButton: { paddingHorizontal: 12, paddingVertical: 8 },
  navButtonText: { fontSize: 16, color: '#111' },
  dateButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
  },
  dateButtonText: { fontSize: 16, fontWeight: '600' },
  todayLink: { alignItems: 'center', marginTop: 8 },
  todayLinkText: { fontSize: 13, color: '#4F46E5' },
  totalText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  list: { flex: 1 },
  listContent: { padding: 16, paddingTop: 8 },
  emptyText: { textAlign: 'center', marginTop: 40, color: '#999' },
  row: {
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
  taskTitle: { fontSize: 15, fontWeight: '600' },
  uncategorizedTitle: { fontStyle: 'italic', color: '#666' },
  taskMeta: { fontSize: 13, color: '#666', marginTop: 2 },
  durationText: { fontSize: 14, fontWeight: '600', color: '#111' },
});
