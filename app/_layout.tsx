import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { DATABASE_NAME, migrateDbIfNeeded } from '../lib/db';

export default function RootLayout() {
  return (
    <Suspense
      fallback={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator />
        </View>
      }
    >
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
        <Stack screenOptions={{ headerBackTitle: 'Back' }}>
          <Stack.Screen name="index" options={{ title: 'Tasks' }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task' }} />
          <Stack.Screen name="new-task" options={{ title: 'New Task', presentation: 'modal' }} />
          <Stack.Screen
            name="new-task-ai"
            options={{ title: 'Quick Add', presentation: 'modal' }}
          />
          <Stack.Screen name="needs-review" options={{ title: 'Needs Review' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="reports" options={{ title: 'Time Report' }} />
          <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
        </Stack>
        <StatusBar style="auto" />
      </SQLiteProvider>
    </Suspense>
  );
}
