import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDueDate } from '../lib/format';
import { listPendingTasksWithDueDate, listProjects } from '../lib/queries';
import type { Project, Task } from '../lib/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMonthGridDays(year: number, month: number): (number | null)[] {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = new Array(startWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const today = new Date();
  const [viewedYear, setViewedYear] = useState(today.getFullYear());
  const [viewedMonth, setViewedMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toDateString(today));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const reload = useCallback(async () => {
    const [taskRows, projectRows] = await Promise.all([
      listPendingTasksWithDueDate(db),
      listProjects(db),
    ]);
    setTasks(taskRows);
    setProjects(projectRows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const countByDay = new Map<string, number>();
  for (const t of tasks) {
    if (t.due_date) countByDay.set(t.due_date, (countByDay.get(t.due_date) ?? 0) + 1);
  }

  const todayString = toDateString(today);
  const tasksForSelectedDay = tasks.filter((t) => t.due_date === selectedDate);
  const cells = getMonthGridDays(viewedYear, viewedMonth);

  function changeMonth(delta: number) {
    let newMonth = viewedMonth + delta;
    let newYear = viewedYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewedMonth(newMonth);
    setViewedYear(newYear);
  }

  return (
    <View style={styles.container}>
      <View style={styles.monthNav}>
        <Pressable style={styles.navButton} onPress={() => changeMonth(-1)}>
          <Text style={styles.navButtonText}>◀</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[viewedMonth]} {viewedYear}
        </Text>
        <Pressable style={styles.navButton} onPress={() => changeMonth(1)}>
          <Text style={styles.navButtonText}>▶</Text>
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekdayLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={i} style={styles.cell} />;
          const dateStr = toDateString(new Date(viewedYear, viewedMonth, day));
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === todayString;
          const count = countByDay.get(dateStr) ?? 0;
          return (
            <Pressable key={i} style={styles.cell} onPress={() => setSelectedDate(dateStr)}>
              <View
                style={[
                  styles.dayCircle,
                  isSelected && styles.dayCircleSelected,
                  isToday && !isSelected && styles.dayCircleToday,
                ]}
              >
                <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>{day}</Text>
              </View>
              {count > 0 && <View style={styles.dot} />}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{formatDueDate(selectedDate)}</Text>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={tasksForSelectedDay}
        keyExtractor={(t) => t.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nothing due this day.</Text>
        }
        renderItem={({ item }) => {
          const project = projectById.get(item.project_id);
          return (
            <Pressable style={styles.taskRow} onPress={() => router.push(`/task/${item.id}`)}>
              <View style={[styles.colorDot, { backgroundColor: project?.color ?? '#999' }]} />
              <View style={styles.taskInfo}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskMeta}>{project?.name ?? 'Unknown project'}</Text>
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const CELL_SIZE = `${100 / 7}%` as const;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingTop: 16,
  },
  navButton: { paddingHorizontal: 12, paddingVertical: 8 },
  navButtonText: { fontSize: 16, color: '#111' },
  monthTitle: { fontSize: 16, fontWeight: '700', minWidth: 140, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row', paddingHorizontal: 8, marginTop: 12 },
  weekdayLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell: {
    width: CELL_SIZE,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleSelected: { backgroundColor: '#111' },
  dayCircleToday: { borderWidth: 1, borderColor: '#111' },
  dayText: { fontSize: 14, color: '#111' },
  dayTextSelected: { color: '#fff', fontWeight: '600' },
  dot: {
    position: 'absolute',
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DC2626',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyText: { textAlign: 'center', marginTop: 24, color: '#999' },
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
  taskTitle: { fontSize: 15, fontWeight: '600' },
  taskMeta: { fontSize: 13, color: '#666', marginTop: 2 },
});
