import { Alert, Platform } from 'react-native';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

type Listener = (alert: AlertRequest | null) => void;
let listener: Listener | null = null;
let nextId = 0;

// react-native-web's Alert.alert is a no-op (see node_modules/react-native-web/src/exports/Alert),
// so on web we route through a listener a mounted <WebAlertHost /> uses to render a real modal.
export function subscribeWebAlert(fn: Listener): () => void {
  listener = fn;
  return () => {
    if (listener === fn) listener = null;
  };
}

export function dismissWebAlert() {
  listener?.(null);
}

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const list = buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }];
  listener?.({ id: ++nextId, title, message, buttons: list });
}
