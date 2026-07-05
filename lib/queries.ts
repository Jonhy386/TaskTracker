import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from './id';
import type {
  Idea,
  PendingCapture,
  PendingCaptureFailureReason,
  Project,
  Task,
  TaskStatus,
  TimeSession,
} from './types';

// --- Projects ---

export async function listProjects(db: SQLiteDatabase, includeClosed = true): Promise<Project[]> {
  if (includeClosed) {
    return db.getAllAsync<Project>('SELECT * FROM projects ORDER BY name');
  }
  return db.getAllAsync<Project>('SELECT * FROM projects WHERE is_closed = 0 ORDER BY name');
}

export async function createProject(
  db: SQLiteDatabase,
  name: string,
  color: string
): Promise<Project> {
  const id = generateId();
  await db.runAsync(
    'INSERT INTO projects (id, name, color, is_closed) VALUES (?, ?, ?, 0)',
    id,
    name,
    color
  );
  return { id, name, color, is_closed: 0 };
}

export async function closeProject(db: SQLiteDatabase, projectId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE projects SET is_closed = 1 WHERE id = ?', projectId);
    await db.runAsync(
      "UPDATE tasks SET status = 'cancelled', updated_at = ? WHERE project_id = ? AND status != 'cancelled'",
      new Date().toISOString(),
      projectId
    );
  });
}

// --- Tasks ---

export async function listTasks(
  db: SQLiteDatabase,
  filters: { projectId?: string; status?: TaskStatus } = {}
): Promise<Task[]> {
  const clauses: string[] = [];
  const params: string[] = [];
  if (filters.projectId) {
    clauses.push('project_id = ?');
    params.push(filters.projectId);
  }
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.getAllAsync<Task>(
    `SELECT * FROM tasks ${where} ORDER BY due_date IS NULL, due_date ASC, created_at DESC`,
    ...params
  );
}

export async function listPendingTasksWithDueDate(db: SQLiteDatabase): Promise<Task[]> {
  return db.getAllAsync<Task>(
    `SELECT * FROM tasks
     WHERE due_date IS NOT NULL AND status IN ('not_started', 'in_progress')
     ORDER BY due_date ASC`
  );
}

export async function getTask(db: SQLiteDatabase, id: string): Promise<Task | null> {
  return db.getFirstAsync<Task>('SELECT * FROM tasks WHERE id = ?', id);
}

export async function createTask(
  db: SQLiteDatabase,
  fields: { title: string; description?: string | null; project_id: string; due_date?: string | null }
): Promise<Task> {
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO tasks (id, title, description, project_id, due_date, status, created_at, updated_at, total_time_seconds)
     VALUES (?, ?, ?, ?, ?, 'not_started', ?, ?, 0)`,
    id,
    fields.title,
    fields.description ?? null,
    fields.project_id,
    fields.due_date ?? null,
    now,
    now
  );
  return {
    id,
    title: fields.title,
    description: fields.description ?? null,
    project_id: fields.project_id,
    due_date: fields.due_date ?? null,
    status: 'not_started',
    created_at: now,
    updated_at: now,
    total_time_seconds: 0,
  };
}

export async function updateTask(
  db: SQLiteDatabase,
  id: string,
  fields: Partial<Pick<Task, 'title' | 'description' | 'project_id' | 'due_date' | 'status'>>
): Promise<void> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const setClause = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v as string | null);
  await db.runAsync(
    `UPDATE tasks SET ${setClause}, updated_at = ? WHERE id = ?`,
    ...values,
    new Date().toISOString(),
    id
  );
}

export async function deleteTask(db: SQLiteDatabase, id: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM time_sessions WHERE task_id = ?', id);
    await db.runAsync('DELETE FROM tasks WHERE id = ?', id);
  });
}

export async function markTaskDone(db: SQLiteDatabase, id: string): Promise<void> {
  await updateTask(db, id, { status: 'done' });
}

// --- Time sessions ---

export async function getRunningSession(db: SQLiteDatabase): Promise<TimeSession | null> {
  return db.getFirstAsync<TimeSession>('SELECT * FROM time_sessions WHERE end_time IS NULL');
}

async function recomputeTotalTime(db: SQLiteDatabase, taskId: string): Promise<void> {
  const row = await db.getFirstAsync<{ total: number | null }>(
    'SELECT SUM(duration_seconds) as total FROM time_sessions WHERE task_id = ?',
    taskId
  );
  await db.runAsync(
    'UPDATE tasks SET total_time_seconds = ? WHERE id = ?',
    row?.total ?? 0,
    taskId
  );
}

async function stopSession(db: SQLiteDatabase, session: TimeSession): Promise<void> {
  const endTime = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((endTime.getTime() - new Date(session.start_time).getTime()) / 1000)
  );
  await db.runAsync(
    'UPDATE time_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?',
    endTime.toISOString(),
    durationSeconds,
    session.id
  );
  await recomputeTotalTime(db, session.task_id);
}

// Starting a timer on any task auto-stops whatever timer is currently running.
export async function startTimer(db: SQLiteDatabase, taskId: string): Promise<TimeSession> {
  const id = generateId();
  const startTime = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    const running = await getRunningSession(db);
    if (running) {
      await stopSession(db, running);
    }
    await db.runAsync(
      'INSERT INTO time_sessions (id, task_id, start_time, end_time, duration_seconds) VALUES (?, ?, ?, NULL, NULL)',
      id,
      taskId,
      startTime
    );
    const task = await getTask(db, taskId);
    if (task && task.status === 'not_started') {
      await updateTask(db, taskId, { status: 'in_progress' });
    }
  });

  return { id, task_id: taskId, start_time: startTime, end_time: null, duration_seconds: null };
}

export async function stopTimer(db: SQLiteDatabase, sessionId: string): Promise<void> {
  await db.withTransactionAsync(async () => {
    const session = await db.getFirstAsync<TimeSession>(
      'SELECT * FROM time_sessions WHERE id = ?',
      sessionId
    );
    if (session && session.end_time === null) {
      await stopSession(db, session);
    }
  });
}

export async function listSessionsForTask(
  db: SQLiteDatabase,
  taskId: string
): Promise<TimeSession[]> {
  return db.getAllAsync<TimeSession>(
    'SELECT * FROM time_sessions WHERE task_id = ? ORDER BY start_time DESC',
    taskId
  );
}

export interface TaskTimeForDay {
  task_id: string;
  title: string;
  project_id: string;
  total_seconds: number;
}

// day is a local calendar date string, YYYY-MM-DD
export async function getTaskTimeForDay(
  db: SQLiteDatabase,
  day: string
): Promise<TaskTimeForDay[]> {
  return db.getAllAsync<TaskTimeForDay>(
    `
    SELECT t.id as task_id, t.title as title, t.project_id as project_id,
           SUM(ts.duration_seconds) as total_seconds
    FROM time_sessions ts
    JOIN tasks t ON t.id = ts.task_id
    WHERE date(ts.start_time, 'localtime') = ? AND ts.duration_seconds IS NOT NULL
    GROUP BY t.id
    ORDER BY total_seconds DESC
  `,
    day
  );
}

// --- Pending captures ---

export async function createPendingCapture(
  db: SQLiteDatabase,
  rawText: string,
  failureReason: PendingCaptureFailureReason,
  audioUri: string | null = null
): Promise<PendingCapture> {
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO pending_captures (id, raw_text, audio_uri, failure_reason, created_at, resolved) VALUES (?, ?, ?, ?, ?, 0)',
    id,
    rawText,
    audioUri,
    failureReason,
    now
  );
  return {
    id,
    raw_text: rawText,
    audio_uri: audioUri,
    failure_reason: failureReason,
    created_at: now,
    resolved: 0,
  };
}

export async function listPendingCaptures(
  db: SQLiteDatabase,
  includeResolved = false
): Promise<PendingCapture[]> {
  if (includeResolved) {
    return db.getAllAsync<PendingCapture>('SELECT * FROM pending_captures ORDER BY created_at DESC');
  }
  return db.getAllAsync<PendingCapture>(
    'SELECT * FROM pending_captures WHERE resolved = 0 ORDER BY created_at DESC'
  );
}

export async function resolvePendingCapture(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE pending_captures SET resolved = 1 WHERE id = ?', id);
}

// --- Ideas ---

export async function createIdea(db: SQLiteDatabase, title: string, body: string): Promise<Idea> {
  const id = generateId();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO ideas (id, title, body, created_at) VALUES (?, ?, ?, ?)',
    id,
    title,
    body,
    now
  );
  return { id, title, body, created_at: now };
}

export async function listIdeas(db: SQLiteDatabase): Promise<Idea[]> {
  return db.getAllAsync<Idea>('SELECT * FROM ideas ORDER BY created_at DESC');
}
