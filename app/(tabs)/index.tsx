import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ElapsedTime } from '../../components/ElapsedTime';
import { formatDuration } from '../../lib/format';
import { hapticImpact } from '../../lib/haptics';
import {
  getRunningSession,
  getTask,
  getTotalsForDateRange,
  listIdeas,
  listPendingTasksWithDueDate,
  listProjects,
  stopTimer,
} from '../../lib/queries';
import { useThemeColors, type ThemeColors } from '../../lib/theme';
import type { Idea, Project, Task, TimeSession } from '../../lib/types';

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
  const [weekSeconds, setWeekSeconds] = useState(0);

  const reload = useCallback(async () => {
    const now = new Date();
    const today = toDateString(now);
    const weekAgo = toDateString(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    const [pendingTasks, projectRows, runningSession, ideas, weekTotals] = await Promise.all([
      listPendingTasksWithDueDate(db),
      listProjects(db),
      getRunningSession(db),
      listIdeas(db),
      getTotalsForDateRange(db, weekAgo, today),
    ]);
    setTasksToday(pendingTasks.filter((t) => t.due_date === today));
    setProjects(projectRows);
    setRunning(runningSession);
    setRecentIdeas(ideas.slice(0, 5));
    setWeekSeconds(weekTotals.reduce((sum, row) => sum + (row.total_seconds ?? 0), 0));
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
  const activeProjectCount = projects.filter((p) => !p.is_closed).length;

  async function handleStop() {
    if (running) {
      hapticImpact();
      await stopTimer(db, running.id);
      reload();
    }
  }

  function handlePromote(idea: Idea) {
    router.push({
      pathname: '/new-task',
      params: {
        prefillTitle: encodeURIComponent(idea.title),
        prefillDescription: encodeURIComponent(idea.body),
        prefillProjectId: idea.project_id ?? '',
        ideaId: idea.id,
      },
    });
  }

  return (
    <View style={styles.flex}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.statRow}>
          <View style={styles.statTile}>
            <View style={[styles.statAccent, { backgroundColor: c.link }]} />
            <Text style={styles.statValue}>{tasksToday.length}</Text>
            <Text style={styles.statLabel}>Due today</Text>
          </View>
          <View style={styles.statTile}>
            <View style={[styles.statAccent, { backgroundColor: '#34D399' }]} />
            <Text style={styles.statValue}>{weekSeconds > 0 ? formatDuration(weekSeconds) : '0m'}</Text>
            <Text style={styles.statLabel}>This week</Text>
          </View>
          <View style={styles.statTile}>
            <View style={[styles.statAccent, { backgroundColor: '#A78BFA' }]} />
            <Text style={styles.statValue}>{activeProjectCount}</Text>
            <Text style={styles.statLabel}>Active projects</Text>
          </View>
        </View>

        <View style={styles.runningCard}>
          {running ? (
            <>
              <View style={styles.runningInfo}>
                <Text style={styles.runningLabel}>
                  {runningTaskTitle ?? projectById.get(running.project_id)?.name ?? 'Timer'}
                </Text>
                <ElapsedTime startTime={running.start_time} style={styles.runningTime} />
              </View>
              <Pressable style={styles.stopButton} onPress={handleStop}>
                <Text style={styles.stopButtonText}>Stop</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.runningIconCircle}>
                <Text style={styles.runningIconText}>⏱</Text>
              </View>
              <View style={styles.runningInfo}>
                <Text style={styles.runningLabel}>Running Timer</Text>
                <Text style={styles.emptyText}>Nothing running right now.</Text>
              </View>
            </>
          )}
        </View>

        {tasksToday.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Due Today</Text>
            {tasksToday.map((task) => {
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
            })}
          </>
        )}

        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Recent Ideas</Text>
          <Pressable onPress={() => router.push('/ideas')} style={styles.seeAllRow}>
            <Text style={styles.seeAllText}>See all</Text>
            <Text style={styles.seeAllChevron}>›</Text>
          </Pressable>
        </View>
        {recentIdeas.length === 0 ? (
          <Text style={styles.emptyText}>No ideas saved yet.</Text>
        ) : (
          recentIdeas.map((idea) => {
            const project = idea.project_id ? projectById.get(idea.project_id) : null;
            return (
              <View
                key={idea.id}
                style={[styles.ideaCard, { borderLeftColor: project?.color ?? c.border }]}
              >
                <Pressable onPress={() => router.push('/ideas')}>
                  <Text style={styles.rowTitle}>{idea.title}</Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {idea.body}
                  </Text>
                </Pressable>
                <View style={styles.ideaFooterRow}>
                  <Text style={styles.ideaProjectTag}>{project?.name ?? 'No project'}</Text>
                  <Pressable style={styles.promoteButton} onPress={() => handlePromote(idea)}>
                    <Text style={styles.promoteButtonText}>Promote to Task</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.fabRow, { bottom: 24 + insets.bottom }]}>
        <Pressable style={styles.fab} onPress={() => router.push('/capture')}>
          <Text style={styles.fabText}>🎤</Text>
        </Pressable>
        <Pressable style={[styles.fab, styles.fabPrimary]} onPress={() => router.push('/new-task')}>
          <Text style={styles.fabTextBold}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16, paddingBottom: 120, gap: 20 },
    statRow: { flexDirection: 'row', gap: 10 },
    statTile: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 12,
      padding: 12,
      overflow: 'hidden',
    },
    statAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    statValue: { fontSize: 20, fontWeight: '700', color: c.text },
    statLabel: { fontSize: 11, color: c.textSecondary, marginTop: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    seeAllRow: { flexDirection: 'row', alignItems: 'center' },
    seeAllText: { fontSize: 13, color: c.link },
    seeAllChevron: { fontSize: 16, color: c.link, marginLeft: 1 },
    emptyText: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    runningCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 14,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      gap: 12,
    },
    runningIconCircle: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    runningIconText: { fontSize: 15 },
    runningInfo: { flex: 1 },
    runningLabel: { fontSize: 14, fontWeight: '600', color: c.text },
    runningTime: { fontSize: 20, fontWeight: '700', color: c.text, marginTop: 2 },
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
      gap: 10,
    },
    colorDot: { width: 10, height: 10, borderRadius: 5 },
    rowInfo: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '600', color: c.text },
    rowMeta: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    ideaCard: {
      backgroundColor: c.surface,
      borderRadius: 10,
      borderLeftWidth: 4,
      padding: 12,
      gap: 4,
    },
    ideaFooterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    ideaProjectTag: { fontSize: 11, color: c.textMuted },
    promoteButton: {
      backgroundColor: c.accent,
      borderRadius: 7,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    promoteButtonText: { fontSize: 11, fontWeight: '700', color: c.accentText },
    fabRow: {
      position: 'absolute',
      right: 24,
      flexDirection: 'column',
      gap: 12,
    },
    fab: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    fabPrimary: { backgroundColor: c.accent, borderWidth: 0 },
    fabText: { fontSize: 22 },
    fabTextBold: { fontSize: 26, fontWeight: '600', color: c.accentText },
  });
}
