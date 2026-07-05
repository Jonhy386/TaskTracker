import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { ParseError, ParsedCapture, parseCaptureAudio, parseCaptureText } from '../lib/ai';
import { generateId } from '../lib/id';
import {
  createIdea,
  createPendingCapture,
  createTask,
  listProjects,
  resolvePendingCapture,
} from '../lib/queries';
import { getApiKey } from '../lib/secure';
import { useThemeColors, type ThemeColors } from '../lib/theme';
import type { Project } from '../lib/types';

type Step = 'idle' | 'recording' | 'parsing';
type Mode = 'voice' | 'type';

async function saveAudioPermanently(tempUri: string): Promise<string> {
  const dir = `${FileSystem.documentDirectory}voice-notes/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const permanentUri = `${dir}${generateId()}.m4a`;
  await FileSystem.copyAsync({ from: tempUri, to: permanentUri });
  return permanentUri;
}

async function discardAudio(uri: string | null) {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}

export default function CaptureScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const c = useThemeColors();
  const styles = useMemo(() => createStyles(c), [c]);
  const { prefillText, prefillAudioUri, pendingCaptureId } = useLocalSearchParams<{
    prefillText?: string;
    prefillAudioUri?: string;
    pendingCaptureId?: string;
  }>();
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState<Mode>(prefillText ? 'type' : 'voice');
  const [step, setStep] = useState<Step>('idle');
  const [rawText, setRawText] = useState(prefillText ? decodeURIComponent(prefillText) : '');
  const startedAudioRetry = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  useEffect(() => {
    Promise.all([getApiKey(), listProjects(db, false)]).then(([key, rows]) => {
      setHasApiKey(!!key);
      setProjects(rows);
    });
    setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true }).catch(() => {});
  }, [db]);

  async function handleParseAudio(audioUri: string) {
    const apiKey = await getApiKey();
    if (!apiKey) {
      setStep('idle');
      Alert.alert('No API key', 'Add your Gemini API key in Settings first.');
      return;
    }
    setStep('parsing');
    try {
      const parsed = await parseCaptureAudio(apiKey, audioUri, projects);
      await saveParsedCapture(parsed, audioUri);
    } catch (err) {
      await handleParseFailure(err, '', audioUri);
    }
  }

  // Retrying a failed audio capture from Needs Review — resend the saved file directly.
  useEffect(() => {
    if (prefillAudioUri && !startedAudioRetry.current) {
      startedAudioRetry.current = true;
      handleParseAudio(decodeURIComponent(prefillAudioUri));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillAudioUri]);

  async function handleStartRecording() {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Microphone access needed',
        'Enable microphone access for TaskTracker in iOS Settings to record voice notes.'
      );
      return;
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setStep('recording');
  }

  async function handleStopRecording() {
    await recorder.stop();
    const tempUri = recorder.uri;
    setStep('parsing');
    if (!tempUri) {
      setStep('idle');
      Alert.alert('Recording failed', 'No audio was captured — please try again.');
      return;
    }
    const permanentUri = await saveAudioPermanently(tempUri);
    await handleParseAudio(permanentUri);
  }

  async function handleParseText() {
    if (!rawText.trim()) return;
    const apiKey = await getApiKey();
    if (!apiKey) {
      Alert.alert('No API key', 'Add your Gemini API key in Settings first.');
      return;
    }
    setStep('parsing');
    try {
      const parsed = await parseCaptureText(apiKey, rawText.trim(), projects);
      await saveParsedCapture(parsed, null);
    } catch (err) {
      await handleParseFailure(err, rawText.trim(), null);
    }
  }

  async function saveParsedCapture(parsed: ParsedCapture, audioUri: string | null) {
    if (parsed.type === 'idea') {
      await createIdea(db, parsed.title, parsed.body, parsed.project_id);
      if (pendingCaptureId) {
        await resolvePendingCapture(db, pendingCaptureId);
      }
      await discardAudio(audioUri);
      router.back();
      return;
    }

    const finalProjectId = parsed.project_id ?? projects[0]?.id ?? null;
    if (!finalProjectId) {
      setStep('idle');
      Alert.alert('No open projects', 'Add a project in Settings before creating tasks.');
      return;
    }
    await createTask(db, {
      title: parsed.title,
      description: parsed.description,
      project_id: finalProjectId,
      due_date: parsed.due_date,
    });
    if (pendingCaptureId) {
      await resolvePendingCapture(db, pendingCaptureId);
    }
    await discardAudio(audioUri);
    router.back();
  }

  async function handleParseFailure(err: unknown, textFallback: string, audioUri: string | null) {
    const reason = err instanceof ParseError ? err.reason : 'api_error';
    setStep('idle');
    if (pendingCaptureId) {
      // Already has a PendingCapture from the first failed attempt — don't duplicate it.
      Alert.alert('Still could not parse that', 'It remains in Needs Review for another try later.');
      return;
    }
    await createPendingCapture(db, textFallback, reason, audioUri);
    Alert.alert(
      'Could not parse that',
      'It was saved to Needs Review so nothing is lost. You can retry it from there.',
      [
        { text: 'OK', style: 'cancel' },
        { text: 'View Needs Review', onPress: () => router.replace('/needs-review') },
      ]
    );
  }

  if (hasApiKey === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.warning}>
          Add your Gemini API key in Settings before using quick add.
        </Text>
        <Pressable style={styles.saveButton} onPress={() => router.replace('/settings')}>
          <Text style={styles.saveButtonText}>Go to Settings</Text>
        </Pressable>
      </View>
    );
  }

  if (step === 'parsing') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>Figuring out if that's a task or an idea…</Text>
      </View>
    );
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
        <View style={styles.modeToggleRow}>
          <Pressable
            style={[styles.modeButton, mode === 'voice' && styles.modeButtonActive]}
            onPress={() => setMode('voice')}
          >
            <Text style={[styles.modeButtonText, mode === 'voice' && styles.modeButtonTextActive]}>
              🎤 Record
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, mode === 'type' && styles.modeButtonActive]}
            onPress={() => setMode('type')}
          >
            <Text style={[styles.modeButtonText, mode === 'type' && styles.modeButtonTextActive]}>
              ⌨️ Type instead
            </Text>
          </Pressable>
        </View>

        {mode === 'voice' ? (
          <View style={styles.recordSection}>
            <Text style={styles.hint}>
              Press the mic and say a task or an idea — Gemini figures out which it is and saves
              it immediately, no review step. Today's date and your open projects are sent along
              so relative dates and project names resolve correctly.
            </Text>
            <Pressable
              style={[styles.micButton, step === 'recording' && styles.micButtonRecording]}
              onPress={step === 'recording' ? handleStopRecording : handleStartRecording}
            >
              <Text style={styles.micButtonText}>{step === 'recording' ? '■' : '🎤'}</Text>
            </Pressable>
            <Text style={styles.recordingStatus}>
              {step === 'recording'
                ? `Recording… ${Math.round(recorderState.durationMillis / 1000)}s (tap to send)`
                : 'Tap to start recording'}
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={rawText}
              onChangeText={setRawText}
              placeholder="e.g. remind me to review the Lactogal OEE report by Friday — or just an idea you want to remember"
              placeholderTextColor={c.textMuted}
              multiline
              autoFocus
            />
            <Pressable
              style={[styles.saveButton, !rawText.trim() && styles.saveButtonDisabled]}
              onPress={handleParseText}
              disabled={!rawText.trim()}
            >
              <Text style={styles.saveButtonText}>Parse & Save</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: c.background },
    container: { flex: 1, backgroundColor: c.background },
    scrollContent: { padding: 16, paddingBottom: 40 },
    centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
    hint: { fontSize: 13, color: c.textSecondary, marginBottom: 16, textAlign: 'center' },
    warning: { color: c.warning, fontSize: 14, marginBottom: 16 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
    },
    multiline: { minHeight: 100, textAlignVertical: 'top' },
    saveButton: {
      marginTop: 24,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: { color: c.accentText, fontWeight: '600', fontSize: 16 },
    modeToggleRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    modeButton: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: c.surfaceAlt,
      alignItems: 'center',
    },
    modeButtonActive: { backgroundColor: c.accent },
    modeButtonText: { fontSize: 14, color: c.text },
    modeButtonTextActive: { color: c.accentText, fontWeight: '600' },
    recordSection: { alignItems: 'center', paddingVertical: 24 },
    micButton: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    micButtonRecording: { backgroundColor: c.danger },
    micButtonText: { fontSize: 36 },
    recordingStatus: { marginTop: 16, fontSize: 14, color: c.textSecondary },
  });
}
