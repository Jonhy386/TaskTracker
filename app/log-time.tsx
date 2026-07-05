import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ElapsedTime } from '../components/ElapsedTime';
import { formatDateTimeDMY, formatDuration, formatTimeOnly } from '../lib/format';
import {
  getRunningSession,
  listProjects,
  listUncategorizedSessions,
  startProjectTimer,
  stopTimer,
} from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Project, TimeSession } from '../lib/types';

export default function LogTimeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [running, setRunning] = useState<TimeSession | null>(null);
  const [uncategorized, setUncategorized] = useState<TimeSession[]>([]);

  const reload = useCallback(async () => {
    const [projectRows, runningSession, uncategorizedRows] = await Promise.all([
      listProjects(db, false),
      getRunningSession(db),
      listUncategorizedSessions(db),
    ]);
    setProjects(projectRows);
    setRunning(runningSession);
    setUncategorized(uncategorizedRows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));

  async function handleStart(projectId: string) {
    await startProjectTimer(db, projectId);
    reload();
  }

  async function handleStop() {
    if (running) {
      await stopTimer(db, running.id);
      reload();
    }
  }

  const runningIsTaskTimer = running && running.task_id !== null;

  return (
    <View style={styles.container}>
      {running && (
        <View style={styles.runningBanner}>
          <Text style={styles.runningBannerText}>
            {runningIsTaskTimer
              ? "A task timer is currently running — starting a project timer will stop it."
              : `Running: ${projectById.get(running.project_id)?.name ?? 'Unknown project'}`}
          </Text>
          {!runningIsTaskTimer && (
            <View style={styles.runningRow}>
              <ElapsedTime startTime={running.start_time} style={styles.runningTime} />
              <Pressable style={styles.stopButton} onPress={handleStop}>
                <Text style={styles.stopButtonText}>Stop</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Start a Timer</Text>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.projectList}
        renderItem={({ item }) => {
          const isThisRunning = running?.task_id === null && running?.project_id === item.id;
          return (
            <View style={styles.projectRow}>
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <Text style={styles.projectName}>{item.name}</Text>
              {!isThisRunning && (
                <Pressable style={styles.startButton} onPress={() => handleStart(item.id)}>
                  <Text style={styles.startButtonText}>Start</Text>
                </Pressable>
              )}
            </View>
          );
        }}
      />

      <Text style={styles.sectionTitle}>Uncategorized Time</Text>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={uncategorized}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>Nothing to categorize — all logged time is assigned.</Text>
        }
        renderItem={({ item }) => {
          const project = projectById.get(item.project_id);
          return (
            <View style={styles.uncategorizedRow}>
              <View style={[styles.colorDot, { backgroundColor: project?.color ?? '#999' }]} />
              <View style={styles.uncategorizedInfo}>
                <Text style={styles.projectName}>{project?.name ?? 'Unknown project'}</Text>
                <Text style={styles.sessionMeta}>
                  {formatDateTimeDMY(item.start_time)}
                  {item.end_time ? ` – ${formatTimeOnly(item.end_time)}` : ''}
                  {item.duration_seconds != null ? ` · ${formatDuration(item.duration_seconds)}` : ''}
                </Text>
              </View>
              <View style={styles.actionsColumn}>
                <Pressable
                  onPress={() => router.push(`/edit-session?sessionId=${item.id}`)}
                  hitSlop={8}
                >
                  <Text style={styles.actionText}>Edit</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.push(`/categorize-session?sessionId=${item.id}`)}
                  hitSlop={8}
                >
                  <Text style={styles.categorizeText}>Categorize</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    runningBanner: {
      margin: 16,
      marginBottom: 0,
      padding: 12,
      borderRadius: 10,
      backgroundColor: c.warningBg,
    },
    runningBannerText: { fontSize: 13, color: c.warning },
    runningRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    runningTime: { fontSize: 16, fontWeight: '700', color: c.warning },
    stopButton: {
      backgroundColor: c.danger,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    stopButtonText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    sectionTitle: {
      fontSize: 15,
      fontWeight: '600',
      marginHorizontal: 16,
      marginTop: 20,
      marginBottom: 8,
      color: c.text,
    },
    projectList: { paddingHorizontal: 16 },
    projectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      backgroundColor: c.surface,
      marginBottom: 8,
      gap: 10,
    },
    colorDot: { width: 10, height: 10, borderRadius: 5 },
    projectName: { flex: 1, fontSize: 15, fontWeight: '600', color: c.text },
    startButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 6,
    },
    startButtonText: { color: c.accentText, fontWeight: '600', fontSize: 13 },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 24 },
    emptyText: { textAlign: 'center', marginTop: 12, color: c.textMuted },
    uncategorizedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: 10,
      backgroundColor: c.surface,
      marginBottom: 8,
      gap: 10,
    },
    uncategorizedInfo: { flex: 1 },
    sessionMeta: { fontSize: 12, color: c.textSecondary, marginTop: 2 },
    actionsColumn: { alignItems: 'flex-end', gap: 8 },
    actionText: { color: c.text, fontSize: 13 },
    categorizeText: { color: c.link, fontSize: 13, fontWeight: '600' },
  });
}
