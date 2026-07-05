import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { closeProject, createProject, listProjects, updateProject } from '../lib/queries';
import { getApiKey, setApiKey } from '../lib/secure';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Project } from '../lib/types';

const PALETTE = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#DB2777'];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [apiKey, setApiKeyState] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingColor, setEditingColor] = useState('');

  const reload = useCallback(async () => {
    const [key, projectRows] = await Promise.all([getApiKey(), listProjects(db)]);
    setApiKeyState(key ?? '');
    setApiKeySaved(!!key);
    setProjects(projectRows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  async function handleSaveApiKey() {
    await setApiKey(apiKey.trim());
    setApiKeySaved(true);
    Alert.alert('Saved', 'API key stored securely on this device.');
  }

  async function handleAddProject() {
    if (!newProjectName.trim()) return;
    const color = PALETTE[projects.length % PALETTE.length];
    await createProject(db, newProjectName.trim(), color);
    setNewProjectName('');
    reload();
  }

  function startEditing(project: Project) {
    setEditingId(project.id);
    setEditingName(project.name);
    setEditingColor(project.color);
  }

  async function handleSaveEdit() {
    if (!editingId || !editingName.trim()) return;
    await updateProject(db, editingId, { name: editingName.trim(), color: editingColor });
    setEditingId(null);
    reload();
  }

  async function handleCloseProject(project: Project) {
    Alert.alert(
      `Close "${project.name}"?`,
      'All of its tasks will be marked cancelled. Projects can never be deleted, only closed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close Project',
          style: 'destructive',
          onPress: async () => {
            await closeProject(db, project.id);
            reload();
          },
        },
      ]
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Google Gemini API Key</Text>
      <Text style={styles.helperText}>
        Used to parse free-text/voice input into structured tasks (free tier). Get one at
        aistudio.google.com/apikey. Stored in the device Keychain. Leave blank to skip AI parsing
        entirely — manual task creation and keyboard dictation work without it.
      </Text>
      <TextInput
        style={styles.input}
        value={apiKey}
        onChangeText={setApiKeyState}
        placeholder="AIza..."
        placeholderTextColor={theme.textMuted}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
      />
      <Pressable style={styles.saveButton} onPress={handleSaveApiKey}>
        <Text style={styles.saveButtonText}>{apiKeySaved ? 'Update Key' : 'Save Key'}</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, styles.projectsHeader]}>Projects</Text>
      <Text style={styles.helperText}>
        The only place new projects are created. Tasks can only pick from open projects.
      </Text>

      {projects.map((p) =>
        editingId === p.id ? (
          <View key={p.id} style={styles.editingBox}>
            <TextInput
              style={styles.input}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Project name"
              placeholderTextColor={theme.textMuted}
            />
            <View style={styles.colorSwatchRow}>
              {PALETTE.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    editingColor === c && styles.colorSwatchSelected,
                  ]}
                  onPress={() => setEditingColor(c)}
                />
              ))}
            </View>
            <View style={styles.editingActions}>
              <Pressable onPress={() => setEditingId(null)} hitSlop={8}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleSaveEdit} hitSlop={8}>
                <Text style={styles.saveEditText}>Save</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View key={p.id} style={styles.projectRow}>
            <View style={[styles.colorDot, { backgroundColor: p.color }]} />
            <Text style={[styles.projectName, p.is_closed ? styles.projectClosed : null]}>
              {p.name}
              {p.is_closed ? ' (closed)' : ''}
            </Text>
            {!p.is_closed && (
              <>
                <Pressable onPress={() => startEditing(p)} hitSlop={8}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => handleCloseProject(p)} hitSlop={8}>
                  <Text style={styles.closeText}>Close</Text>
                </Pressable>
              </>
            )}
          </View>
        )
      )}

      <View style={styles.addProjectRow}>
        <TextInput
          style={[styles.input, styles.addProjectInput]}
          value={newProjectName}
          onChangeText={setNewProjectName}
          placeholder="New project name"
          placeholderTextColor={theme.textMuted}
        />
        <Pressable style={styles.addButton} onPress={handleAddProject}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { padding: 16 },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: c.text },
    projectsHeader: { marginTop: 32 },
    helperText: { fontSize: 13, color: c.textSecondary, marginTop: 4, marginBottom: 12 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
    },
    saveButton: {
      marginTop: 12,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    saveButtonText: { color: c.accentText, fontWeight: '600' },
    projectRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    colorDot: { width: 10, height: 10, borderRadius: 5 },
    projectName: { flex: 1, fontSize: 15, color: c.text },
    projectClosed: { color: c.textMuted },
    editText: { color: c.link, fontSize: 13, marginRight: 16 },
    closeText: { color: c.danger, fontSize: 13 },
    editingBox: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 10,
    },
    colorSwatchRow: { flexDirection: 'row', gap: 10 },
    colorSwatch: { width: 28, height: 28, borderRadius: 14 },
    colorSwatchSelected: { borderWidth: 3, borderColor: c.text },
    editingActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 20 },
    cancelText: { color: c.textSecondary, fontSize: 14 },
    saveEditText: { color: c.text, fontWeight: '600', fontSize: 14 },
    addProjectRow: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
    addProjectInput: { flex: 1 },
    addButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    addButtonText: { color: c.accentText, fontWeight: '600' },
  });
}
