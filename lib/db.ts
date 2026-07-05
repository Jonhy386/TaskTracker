import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'tasktracker.db';

const DEFAULT_PROJECTS = [
  { id: 'aqs', name: 'AQS', color: '#4F46E5' },
  { id: 'lactogal', name: 'Lactogal', color: '#059669' },
  { id: 'caetano', name: 'Caetano', color: '#DC2626' },
  { id: 'kt-internal', name: 'KT Internal', color: '#D97706' },
];

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 3;
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let currentVersion = row?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        is_closed INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        project_id TEXT NOT NULL,
        due_date TEXT,
        status TEXT NOT NULL DEFAULT 'not_started',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        total_time_seconds INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS time_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_seconds INTEGER,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      );

      CREATE TABLE IF NOT EXISTS pending_captures (
        id TEXT PRIMARY KEY NOT NULL,
        raw_text TEXT NOT NULL,
        failure_reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        resolved INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_sessions_task ON time_sessions(task_id);
    `);

    for (const p of DEFAULT_PROJECTS) {
      await db.runAsync(
        'INSERT OR IGNORE INTO projects (id, name, color, is_closed) VALUES (?, ?, ?, 0)',
        p.id,
        p.name,
        p.color
      );
    }

    currentVersion = 1;
  }

  if (currentVersion === 1) {
    await db.execAsync(`ALTER TABLE pending_captures ADD COLUMN audio_uri TEXT;`);
    currentVersion = 2;
  }

  if (currentVersion === 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ideas (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    currentVersion = 3;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
