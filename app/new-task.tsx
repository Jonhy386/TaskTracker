import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
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
import { createTask, listProjects } from '../lib/queries';
import type { Project } from '../lib/types';

export default function NewTaskScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listProjects(db, false).then((rows) => {
      setProjects(rows);
      if (rows.length > 0) setProjectId(rows[0].id);
    });
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
        autoFocus
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Optional details"
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
          <Text>{dueDate ? formatDateDMY(toDateString(dueDate)) : 'No due date'}</Text>
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

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 16, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  pickerWrap: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8 },
  warning: { color: '#B45309', fontSize: 13 },
  dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  dateButton: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearText: { color: '#DC2626', fontSize: 13 },
  saveButton: {
    marginTop: 32,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
