import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTimeDMY } from '../lib/format';
import { deleteIdea, listIdeas, listProjects, setIdeaProject } from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Idea, Project } from '../lib/types';

export default function IdeasScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const reload = useCallback(async () => {
    const [ideaRows, projectRows] = await Promise.all([listIdeas(db), listProjects(db)]);
    setIdeas(ideaRows);
    setProjects(projectRows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  const projectById = new Map(projects.map((p) => [p.id, p]));

  function handleDelete(idea: Idea) {
    Alert.alert('Delete this idea?', idea.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteIdea(db, idea.id);
          reload();
        },
      },
    ]);
  }

  function handleSetProject(idea: Idea) {
    const buttons = projects
      .filter((p) => !p.is_closed)
      .map((p) => ({
        text: p.name,
        onPress: async () => {
          await setIdeaProject(db, idea.id, p.id);
          reload();
        },
      }));
    if (idea.project_id) {
      buttons.push({
        text: 'Remove project',
        onPress: async () => {
          await setIdeaProject(db, idea.id, null);
          reload();
        },
      });
    }
    Alert.alert('Link to project', idea.title, [...buttons, { text: 'Cancel', style: 'cancel' }]);
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
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={ideas}
      keyExtractor={(i) => i.id}
      ListEmptyComponent={
        <Text style={styles.emptyText}>
          No ideas saved yet — record or type one from the mic button.
        </Text>
      }
      renderItem={({ item }) => {
        const project = item.project_id ? projectById.get(item.project_id) : null;
        return (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.title}>{item.title}</Text>
              <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
            <Text style={styles.body}>{item.body}</Text>

            <Pressable style={styles.projectTag} onPress={() => handleSetProject(item)}>
              {project ? (
                <>
                  <View style={[styles.colorDot, { backgroundColor: project.color }]} />
                  <Text style={styles.projectTagText}>{project.name}</Text>
                </>
              ) : (
                <Text style={styles.projectTagTextMuted}>+ Link to project</Text>
              )}
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.date}>{formatDateTimeDMY(item.created_at)}</Text>
              <Pressable onPress={() => handlePromote(item)}>
                <Text style={styles.promoteText}>Promote to Task →</Text>
              </Pressable>
            </View>
          </View>
        );
      }}
    />
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16 },
    emptyText: { textAlign: 'center', marginTop: 40, color: c.textMuted },
    row: {
      padding: 14,
      borderRadius: 10,
      backgroundColor: c.surface,
      marginBottom: 12,
    },
    rowHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    title: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 12, color: c.text },
    deleteText: { color: c.danger, fontSize: 13 },
    body: { fontSize: 14, color: c.textSecondary, marginTop: 6, lineHeight: 20 },
    projectTag: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
    colorDot: { width: 8, height: 8, borderRadius: 4 },
    projectTagText: { fontSize: 12, color: c.text, fontWeight: '600' },
    projectTagTextMuted: { fontSize: 12, color: c.link },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 8,
    },
    date: { fontSize: 12, color: c.textMuted },
    promoteText: { fontSize: 12, color: c.text, fontWeight: '600' },
  });
}
