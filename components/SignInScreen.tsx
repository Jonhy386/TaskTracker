import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useThemeColors, type ThemeColors } from '../lib/theme';

export default function SignInScreen() {
  const c = useThemeColors();
  const styles = createStyles(c);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const emailRedirectTo = Platform.OS === 'web' ? window.location.origin : undefined;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: emailRedirectTo ? { emailRedirectTo } : undefined,
    });
    setSending(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  }

  async function handleVerify() {
    const trimmedCode = code.trim();
    if (!trimmedCode) return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: trimmedCode,
      type: 'email',
    });
    setVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
    }
    // On success, useSession's onAuthStateChange picks up the new session
    // automatically and this screen unmounts.
  }

  if (sent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          Sent to {email.trim()}. On a Home Screen app, type the 6-digit code below instead of
          tapping the link — the link opens in a separate browser session that won't carry over.
        </Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={setCode}
          placeholder="123456"
          placeholderTextColor={c.textMuted}
          keyboardType="number-pad"
          autoFocus
          onSubmitEditing={handleVerify}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          style={[styles.button, (!code.trim() || verifying) && styles.buttonDisabled]}
          onPress={handleVerify}
          disabled={!code.trim() || verifying}
        >
          {verifying ? <ActivityIndicator color={c.accentText} /> : <Text style={styles.buttonText}>Verify code</Text>}
        </Pressable>
        <Pressable
          style={styles.linkButton}
          onPress={() => {
            setSent(false);
            setCode('');
            setError(null);
          }}
        >
          <Text style={styles.linkButtonText}>Use a different email</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TaskTracker</Text>
      <Text style={styles.subtitle}>Sign in with a magic link — no password needed.</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={c.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoFocus
        onSubmitEditing={handleSend}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.button, (!email.trim() || sending) && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={!email.trim() || sending}
      >
        {sending ? (
          <ActivityIndicator color={c.accentText} />
        ) : (
          <Text style={styles.buttonText}>Send magic link</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    title: { fontSize: 28, fontWeight: '700', color: c.text, marginBottom: 8 },
    subtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', marginBottom: 24, maxWidth: 320 },
    input: {
      width: '100%',
      maxWidth: 320,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: c.text,
      marginBottom: 16,
    },
    codeInput: { textAlign: 'center', letterSpacing: 4, fontSize: 20 },
    error: { color: c.danger, fontSize: 13, marginBottom: 12, textAlign: 'center' },
    button: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { color: c.accentText, fontWeight: '600', fontSize: 16 },
    linkButton: { marginTop: 16 },
    linkButtonText: { color: c.link, fontSize: 14 },
  });
}
