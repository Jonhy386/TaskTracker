import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { dismissWebAlert, subscribeWebAlert, type AlertButton, type AlertRequest } from '../lib/alert';
import { useThemeColors, type ThemeColors } from '../lib/theme';

export default function WebAlertHost() {
  const [alert, setAlert] = useState<AlertRequest | null>(null);
  const c = useThemeColors();
  const styles = createStyles(c);

  useEffect(() => subscribeWebAlert(setAlert), []);

  if (!alert) return null;

  function press(button: AlertButton) {
    dismissWebAlert();
    button.onPress?.();
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>{alert.title}</Text>
        {alert.message ? <Text style={styles.message}>{alert.message}</Text> : null}
        <View style={styles.buttons}>
          {alert.buttons.map((b, i) => (
            <Pressable key={i} style={styles.button} onPress={() => press(b)}>
              <Text
                style={[
                  styles.buttonText,
                  b.style === 'destructive' && styles.destructiveText,
                  b.style === 'cancel' && styles.cancelText,
                ]}
              >
                {b.text}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

function createStyles(c: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: 'fixed' as 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 340,
      borderRadius: 14,
      backgroundColor: c.surface,
      overflow: 'hidden',
      paddingTop: 20,
      paddingHorizontal: 20,
    },
    title: { fontSize: 17, fontWeight: '600', color: c.text, textAlign: 'center' },
    message: { fontSize: 14, color: c.textSecondary, textAlign: 'center', marginTop: 8 },
    buttons: { marginTop: 20, marginHorizontal: -20 },
    button: {
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      alignItems: 'center',
    },
    buttonText: { fontSize: 16, color: c.link },
    cancelText: { color: c.textSecondary },
    destructiveText: { color: c.danger, fontWeight: '600' },
  });
}
