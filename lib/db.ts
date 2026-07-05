import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'tasktracker.db';

const DEFAULT_PROJECTS = [
  { id: 'aqs', name: 'AQS', color: '#4F46E5' },
  { id: 'lactogal', name: 'Lactogal', color: '#059669' },
  { id: 'caetano', name: 'Caetano', color: '#DC2626' },
  { id: 'kt-internal', name: 'KT Internal', color: '#D97706' },
];

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const DATABASE_VERSION = 5;
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

  if (currentVersion === 3) {
    // Rebuild time_sessions to allow task_id to be null (time logged against a
    // project directly, categorized into a task later). project_id is
    // denormalized onto every session (backfilled from the task for existing
    // rows) so a session keeps its original project attribution even if the
    // task is later reassigned to a different project.
    await db.execAsync(`
      CREATE TABLE time_sessions_new (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT,
        project_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        duration_seconds INTEGER,
        FOREIGN KEY (task_id) REFERENCES tasks(id),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      INSERT INTO time_sessions_new (id, task_id, project_id, start_time, end_time, duration_seconds)
      SELECT ts.id, ts.task_id, t.project_id, ts.start_time, ts.end_time, ts.duration_seconds
      FROM time_sessions ts
      JOIN tasks t ON t.id = ts.task_id;

      DROP TABLE time_sessions;
      ALTER TABLE time_sessions_new RENAME TO time_sessions;

      CREATE INDEX IF NOT EXISTS idx_sessions_task ON time_sessions(task_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_project ON time_sessions(project_id);
    `);
    currentVersion = 4;
  }

  if (currentVersion === 4) {
    await db.execAsync(`ALTER TABLE ideas ADD COLUMN project_id TEXT;`);
    currentVersion = 5;
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
