import { Stack, useRouter } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import SignInScreen from '../components/SignInScreen';
import SyncManager from '../components/SyncManager';
import WebAlertHost from '../components/WebAlertHost';
import { checkCaptureIntent } from '../lib/captureIntent';
import { DATABASE_NAME, migrateDbIfNeeded } from '../lib/db';
import { useThemeColors } from '../lib/theme';
import { useSession } from '../lib/useSession';

export default function RootLayout() {
  const c = useThemeColors();
  const { session, loading } = useSession();
  const router = useRouter();
  const userId = session?.user.id;

  // See lib/captureIntent.ts - an iOS Shortcut bound to the Action Button
  // can signal "open Quick Add and start recording" through the database
  // (webapp:// launches can't carry a URL path). Re-check on every
  // focus/visibilitychange too, since re-launching often just brings an
  // already-running instance back to the foreground instead of remounting.
  useEffect(() => {
    if (!userId || Platform.OS !== 'web') return;
    checkCaptureIntent(userId, router);
    const onFocus = () => checkCaptureIntent(userId, router);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [userId, router]);

  const spinner = (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
      <ActivityIndicator />
    </View>
  );

  if (loading) {
    return spinner;
  }

  if (!session) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SignInScreen />
        <WebAlertHost />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Suspense fallback={spinner}>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
        <Stack
          screenOptions={{
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: c.background },
            headerTintColor: c.text,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: c.background },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Today' }} />
          <Stack.Screen name="tasks" options={{ title: 'Tasks' }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="new-task" options={{ title: 'New Task', presentation: 'modal' }} />
          <Stack.Screen
            name="capture"
            options={{ title: 'Quick Add', presentation: 'modal' }}
          />
          <Stack.Screen name="needs-review" options={{ title: 'Needs Review' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="reports" options={{ title: 'Time Report' }} />
          <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
          <Stack.Screen name="ideas" options={{ title: 'Ideas' }} />
          <Stack.Screen name="log-time" options={{ title: 'Log Time' }} />
          <Stack.Screen
            name="categorize-session"
            options={{ title: 'Categorize Time', presentation: 'modal' }}
          />
          <Stack.Screen
            name="edit-session"
            options={{ title: 'Edit Time', presentation: 'modal' }}
          />
          <Stack.Screen name="menu" options={{ title: 'Menu', presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
        <SyncManager userId={session.user.id} />
      </SQLiteProvider>
    </Suspense>
    <WebAlertHost />
    </GestureHandlerRootView>
  );
}
