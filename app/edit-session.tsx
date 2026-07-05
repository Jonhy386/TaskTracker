import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDateTimeDMY } from '../lib/format';
import { getSessionById, updateSessionTimes } from '../lib/queries';

export default function EditSessionScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [loaded, setLoaded] = useState(false);
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    getSessionById(db, sessionId).then((row) => {
      if (row) {
        setStartTime(new Date(row.start_time));
        setEndTime(row.end_time ? new Date(row.end_time) : new Date());
      }
      setLoaded(true);
    });
  }, [db, sessionId]);

  async function handleSave() {
    if (endTime.getTime() <= startTime.getTime()) {
      Alert.alert('Invalid times', 'End time must be after start time.');
      return;
    }
    await updateSessionTimes(db, sessionId, startTime.toISOString(), endTime.toISOString());
    router.back();
  }

  if (!loaded) {
    return (
      <View style={styles.container}>
        <Text>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Start</Text>
      <Pressable style={styles.dateButton} onPress={() => setShowPicker('start')}>
        <Text>{formatDateTimeDMY(startTime.toISOString())}</Text>
      </Pressable>

      <Text style={styles.label}>End</Text>
      <Pressable style={styles.dateButton} onPress={() => setShowPicker('end')}>
        <Text>{formatDateTimeDMY(endTime.toISOString())}</Text>
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={showPicker === 'start' ? startTime : endTime}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_e, selected) => {
            setShowPicker(Platform.OS === 'ios' ? showPicker : null);
            if (selected) {
              if (showPicker === 'start') setStartTime(selected);
              else setEndTime(selected);
            }
          }}
        />
      )}

      {Platform.OS === 'ios' && showPicker && (
        <Pressable style={styles.doneButton} onPress={() => setShowPicker(null)}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      )}

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 16, marginBottom: 6 },
  dateButton: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  doneButton: { marginTop: 8, alignItems: 'center', paddingVertical: 8 },
  doneButtonText: { color: '#4F46E5', fontWeight: '600' },
  saveButton: {
    marginTop: 24,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
