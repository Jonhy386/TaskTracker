import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatDateDMY } from '../lib/format';
import { createTask, deleteIdea, listProjects } from '../lib/queries';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Project } from '../lib/types';

export default function NewTaskScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { prefillTitle, prefillDescription, prefillProjectId, ideaId } = useLocalSearchParams<{
    prefillTitle?: string;
    prefillDescription?: string;
    prefillProjectId?: string;
    ideaId?: string;
  }>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState(prefillTitle ? decodeURIComponent(prefillTitle) : '');
  const [description, setDescription] = useState(
    prefillDescription ? decodeURIComponent(prefillDescription) : ''
  );
  const [projectId, setProjectId] = useState<string | null>(prefillProjectId || null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProjects(db, false).then((rows) => {
      setProjects(rows);
      if (!projectId && rows.length > 0) setProjectId(rows[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  async function handleSave() {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a task title.');
      return;
    }
    if (!projectId) {
      Alert.alert('Project required', 'Please select a project.');
      return;
    }
    setSaving(true);
    try {
      await createTask(db, {
        title: title.trim(),
        description: description.trim() || null,
        project_id: projectId,
        due_date: dueDate ? toDateString(dueDate) : null,
      });
      if (ideaId) {
        await deleteIdea(db, ideaId);
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Review the OEE report"
        placeholderTextColor={c.textMuted}
        autoFocus
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional details"
        placeholderTextColor={c.textMuted}
        multiline
      />

      <Text style={styles.label}>Project</Text>
      {projects.length === 0 ? (
        <Text style={styles.warning}>
          No open projects yet. Add one in Settings before creating a task.
        </Text>
      ) : (
        <View style={styles.pickerWrap}>
          <Picker selectedValue={projectId} onValueChange={(v) => setProjectId(v)}>
            {projects.map((p) => (
              <Picker.Item key={p.id} label={p.name} value={p.id} />
            ))}
          </Picker>
        </View>
      )}

      <Text style={styles.label}>Due date</Text>
      <View style={styles.dueDateRow}>
        <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
          <Text style={{ color: c.text }}>
            {dueDate ? formatDateDMY(toDateString(dueDate)) : 'No due date'}
          </Text>
        </Pressable>
        {dueDate && (
          <Pressable onPress={() => setDueDate(null)} hitSlop={8}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={dueDate ?? new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_event, selected) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selected) setDueDate(selected);
          }}
        />
      )}

      <Pressable
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving || projects.length === 0}
      >
        <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Task'}</Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    label: { fontSize: 13, fontWeight: '600', color: c.textSecondary, marginTop: 16, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
    },
    multiline: { minHeight: 80, textAlignVertical: 'top' },
    pickerWrap: { borderWidth: 1, borderColor: c.border, borderRadius: 8 },
    warning: { color: c.warning, fontSize: 13 },
    dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    dateButton: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    clearText: { color: c.danger, fontSize: 13 },
    saveButton: {
      marginTop: 32,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: c.accentText, fontWeight: '600', fontSize: 16 },
  });
}
