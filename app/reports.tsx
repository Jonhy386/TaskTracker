import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateDMY, formatDuration } from '../lib/format';
import {
  getTaskTimeForDay,
  getTotalsForDateRange,
  listProjects,
  type TaskTimeForDay,
} from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Project } from '../lib/types';

type Mode = 'day' | 'week';

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

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ReportsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [mode, setMode] = useState<Mode>('day');
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tasks, setTasks] = useState<TaskTimeForDay[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [weekTotals, setWeekTotals] = useState<Record<string, number>>({});

  const dayString = toDateString(selectedDate);
  const weekStart = getWeekStart(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const reload = useCallback(async () => {
    if (mode === 'day') {
      const [taskRows, projectRows] = await Promise.all([
        getTaskTimeForDay(db, dayString),
        listProjects(db),
      ]);
      setTasks(taskRows);
      setProjects(projectRows);
    } else {
      const rows = await getTotalsForDateRange(
        db,
        toDateString(weekStart),
        toDateString(addDays(weekStart, 6))
      );
      const map: Record<string, number> = {};
      for (const r of rows) map[r.day] = r.total_seconds;
      setWeekTotals(map);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, mode, dayString, toDateString(weekStart)]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const totalSeconds = tasks.reduce((sum, t) => sum + t.total_seconds, 0);
  const weekTotalSeconds = Object.values(weekTotals).reduce((sum, s) => sum + s, 0);
  const maxWeekSeconds = Math.max(1, ...Object.values(weekTotals));

  return (
    <View style={styles.container}>
      <View style={styles.modeToggleRow}>
        <Pressable
          style={[styles.modeButton, mode === 'day' && styles.modeButtonActive]}
          onPress={() => setMode('day')}
        >
          <Text style={[styles.modeButtonText, mode === 'day' && styles.modeButtonTextActive]}>
            Day
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, mode === 'week' && styles.modeButtonActive]}
          onPress={() => setMode('week')}
        >
          <Text style={[styles.modeButtonText, mode === 'week' && styles.modeButtonTextActive]}>
            Week
          </Text>
        </Pressable>
      </View>

      {mode === 'day' ? (
        <>
          <View style={styles.dateNav}>
            <Pressable style={styles.navButton} onPress={() => setSelectedDate((d) => addDays(d, -1))}>
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
            ListEmptyComponent={<Text style={styles.emptyText}>No time tracked on this day.</Text>}
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
        </>
      ) : (
        <>
          <View style={styles.dateNav}>
            <Pressable style={styles.navButton} onPress={() => setSelectedDate((d) => addDays(d, -7))}>
              <Text style={styles.navButtonText}>◀</Text>
            </Pressable>
            <Text style={styles.dateButtonText}>
              {formatDateDMY(toDateString(weekStart))} – {formatDateDMY(toDateString(addDays(weekStart, 6)))}
            </Text>
            <Pressable style={styles.navButton} onPress={() => setSelectedDate((d) => addDays(d, 7))}>
              <Text style={styles.navButtonText}>▶</Text>
            </Pressable>
          </View>

          <Text style={styles.totalText}>Week total: {formatDuration(weekTotalSeconds)}</Text>

          <View style={styles.weekChart}>
            {weekDays.map((d, i) => {
              const key = toDateString(d);
              const seconds = weekTotals[key] ?? 0;
              const heightPct = seconds > 0 ? Math.max(6, (seconds / maxWeekSeconds) * 100) : 0;
              return (
                <Pressable
                  key={key}
                  style={styles.weekBarColumn}
                  onPress={() => {
                    setSelectedDate(d);
                    setMode('day');
                  }}
                >
                  <View style={styles.weekBarTrack}>
                    <View style={[styles.weekBarFill, { height: `${heightPct}%` }]} />
                  </View>
                  <Text style={styles.weekBarLabel}>{WEEKDAY_SHORT[i]}</Text>
                  <Text style={styles.weekBarValue}>
                    {seconds > 0 ? formatDuration(seconds) : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    modeToggleRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 },
    modeButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
    },
    modeButtonActive: { backgroundColor: c.accent },
    modeButtonText: { fontSize: 14, color: c.text },
    modeButtonTextActive: { color: c.accentText, fontWeight: '600' },
    dateNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingTop: 16,
      paddingHorizontal: 16,
    },
    navButton: { paddingHorizontal: 12, paddingVertical: 8 },
    navButtonText: { fontSize: 16, color: c.text },
    dateButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
    },
    dateButtonText: { fontSize: 16, fontWeight: '600', color: c.text },
    todayLink: { alignItems: 'center', marginTop: 8 },
    todayLinkText: { fontSize: 13, color: c.link },
    totalText: {
      textAlign: 'center',
      fontSize: 14,
      color: c.textSecondary,
      marginTop: 16,
      marginBottom: 8,
    },
    list: { flex: 1 },
    listContent: { padding: 16, paddingTop: 8 },
    emptyText: { textAlign: 'center', marginTop: 40, color: c.textMuted },
    row: {
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
    taskTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    uncategorizedTitle: { fontStyle: 'italic', color: c.textSecondary },
    taskMeta: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    durationText: { fontSize: 14, fontWeight: '600', color: c.text },
    weekChart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: 16,
      marginTop: 24,
      height: 220,
    },
    weekBarColumn: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
    weekBarTrack: {
      width: 24,
      height: 140,
      borderRadius: 6,
      backgroundColor: c.surfaceAlt,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    weekBarFill: { width: '100%', backgroundColor: c.accent, borderRadius: 6 },
    weekBarLabel: { fontSize: 12, color: c.textSecondary, marginTop: 8, fontWeight: '600' },
    weekBarValue: { fontSize: 10, color: c.textMuted, marginTop: 2 },
  });
}
