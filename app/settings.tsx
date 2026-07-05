import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
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
import { closeProject, createProject, listProjects } from '../lib/queries';
import { getApiKey, setApiKey } from '../lib/secure';
import type { Project } from '../lib/types';

const PALETTE = ['#4F46E5', '#059669', '#DC2626', '#D97706', '#7C3AED', '#0891B2', '#DB2777'];

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [apiKey, setApiKeyState] = useState('');
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectName, setNewProjectName] = useState('');

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

      {projects.map((p) => (
        <View key={p.id} style={styles.projectRow}>
          <View style={[styles.colorDot, { backgroundColor: p.color }]} />
          <Text style={[styles.projectName, p.is_closed ? styles.projectClosed : null]}>
            {p.name}
            {p.is_closed ? ' (closed)' : ''}
          </Text>
          {!p.is_closed && (
            <Pressable onPress={() => handleCloseProject(p)} hitSlop={8}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          )}
        </View>
      ))}

      <View style={styles.addProjectRow}>
        <TextInput
          style={[styles.input, styles.addProjectInput]}
          value={newProjectName}
          onChangeText={setNewProjectName}
          placeholder="New project name"
        />
        <Pressable style={styles.addButton} onPress={handleAddProject}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  projectsHeader: { marginTop: 32 },
  helperText: { fontSize: 13, color: '#666', marginTop: 4, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  saveButton: {
    marginTop: 12,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  projectName: { flex: 1, fontSize: 15 },
  projectClosed: { color: '#999' },
  closeText: { color: '#DC2626', fontSize: 13 },
  addProjectRow: { flexDirection: 'row', gap: 8, marginTop: 16, alignItems: 'center' },
  addProjectInput: { flex: 1 },
  addButton: {
    backgroundColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
});
