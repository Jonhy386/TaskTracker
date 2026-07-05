import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DATABASE_NAME, migrateDbIfNeeded } from '../lib/db';
import { useThemeColors } from '../lib/theme';

export default function RootLayout() {
  const c = useThemeColors();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}>
          <ActivityIndicator />
        </View>
      }
    >
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
      </SQLiteProvider>
    </Suspense>
    </GestureHandlerRootView>
  );
}
