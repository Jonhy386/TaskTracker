import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ElapsedTime } from '../components/ElapsedTime';
import { formatDuration } from '../lib/format';
import { hapticImpact } from '../lib/haptics';
import {
  getRunningSession,
  getTask,
  listIdeas,
  listPendingTasksWithDueDate,
  listProjects,
  stopTimer,
} from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Idea, Project, Task, TimeSession } from '../lib/types';

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function TodayScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [tasksToday, setTasksToday] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [running, setRunning] = useState<TimeSession | null>(null);
  const [runningTaskTitle, setRunningTaskTitle] = useState<string | null>(null);
  const [recentIdeas, setRecentIdeas] = useState<Idea[]>([]);

  const reload = useCallback(async () => {
    const today = toDateString(new Date());
    const [pendingTasks, projectRows, runningSession, ideas] = await Promise.all([
      listPendingTasksWithDueDate(db),
      listProjects(db),
      getRunningSession(db),
      listIdeas(db),
    ]);
    setTasksToday(pendingTasks.filter((t) => t.due_date === today));
    setProjects(projectRows);
    setRunning(runningSession);
    setRecentIdeas(ideas.slice(0, 5));
    setRunningTaskTitle(
      runningSession?.task_id ? (await getTask(db, runningSession.task_id))?.title ?? null : null
    );
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));

  async function handleStop() {
    if (running) {
      hapticImpact();
      await stopTimer(db, running.id);
      reload();
    }
  }

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/menu')} hitSlop={8}>
              <Text style={styles.hamburgerText}>☰</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Running Timer</Text>
        {running ? (
          <View style={styles.runningBox}>
            <View style={styles.runningInfo}>
              <Text style={styles.runningLabel}>
                {runningTaskTitle ?? projectById.get(running.project_id)?.name ?? 'Timer'}
              </Text>
              <ElapsedTime startTime={running.start_time} style={styles.runningTime} />
            </View>
            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Text style={styles.stopButtonText}>Stop</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.emptyText}>Nothing running right now.</Text>
        )}

        <Text style={styles.sectionTitle}>Due Today</Text>
        {tasksToday.length === 0 ? (
          <Text style={styles.emptyText}>Nothing due today.</Text>
        ) : (
          tasksToday.map((task) => {
            const project = projectById.get(task.project_id);
            return (
              <Pressable
                key={task.id}
                style={styles.row}
                onPress={() => router.push(`/task/${task.id}`)}
              >
                <View style={[styles.colorDot, { backgroundColor: project?.color ?? '#999' }]} />
                <View style={styles.rowInfo}>
                  <Text style={styles.rowTitle}>{task.title}</Text>
                  <Text style={styles.rowMeta}>{project?.name ?? 'Unknown project'}</Text>
                </View>
                {task.total_time_seconds > 0 && (
                  <Text style={styles.rowMeta}>{formatDuration(task.total_time_seconds)}</Text>
                )}
              </Pressable>
            );
          })
        )}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Recent Ideas</Text>
          <Pressable onPress={() => router.push('/ideas')}>
            <Text style={styles.seeAllText}>See all →</Text>
          </Pressable>
        </View>
        {recentIdeas.length === 0 ? (
          <Text style={styles.emptyText}>No ideas saved yet.</Text>
        ) : (
          recentIdeas.map((idea) => (
            <Pressable key={idea.id} style={styles.row} onPress={() => router.push('/ideas')}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowTitle}>{idea.title}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {idea.body}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

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

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, backgroundColor: c.background },
    hamburgerText: { fontSize: 22, paddingHorizontal: 8, color: c.text },
    content: { padding: 16, paddingBottom: 120 },
    sectionTitle: { fontSize: 15, fontWeight: '600', marginTop: 24, marginBottom: 8, color: c.text },
    sectionTitleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 24,
    },
    seeAllText: { fontSize: 13, color: c.link },
    emptyText: { color: c.textMuted, fontSize: 13 },
    runningBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 10,
      backgroundColor: c.warningBg,
    },
    runningInfo: {},
    runningLabel: { fontSize: 13, fontWeight: '600', color: c.warning },
    runningTime: { fontSize: 20, fontWeight: '700', color: c.warning, marginTop: 2 },
    stopButton: {
      backgroundColor: c.danger,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    stopButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
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
    rowInfo: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    rowMeta: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
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
  });
}
