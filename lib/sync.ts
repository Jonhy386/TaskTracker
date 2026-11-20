import type { SQLiteDatabase } from 'expo-sqlite';
import { supabase } from './supabase';
import { SYNCED_TABLES, type OutboxEntry, type SyncTable } from './syncOutbox';
import type { Idea, Project, Task, TimeSession } from './types';

let syncing = false;

// Pulls down anything new from the cloud, pushes up anything queued locally,
// and - the first time this account has no cloud data yet - imports whatever
// is already in the local SQLite cache. Safe to call often; re-entrant calls
// are skipped while one is already running.
export async function runSync(db: SQLiteDatabase, userId: string): Promise<void> {
  if (syncing) return;
  syncing = true;
  try {
    await importLocalDataIfCloudEmpty(db, userId);
    await pushOutbox(db, userId);
    await pullFromCloud(db, userId);
  } catch (err) {
    console.warn('[sync] run failed', err);
  } finally {
    syncing = false;
  }
}

async function importLocalDataIfCloudEmpty(db: SQLiteDatabase, userId: string): Promise<void> {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error || (count ?? 0) > 0) return;

  const projects = await db.getAllAsync<Project>('SELECT * FROM projects');
  const tasks = await db.getAllAsync<Task>('SELECT * FROM tasks');
  const ideas = await db.getAllAsync<Idea>('SELECT * FROM ideas');
  const sessions = await db.getAllAsync<TimeSession>('SELECT * FROM time_sessions');
  if (!projects.length && !tasks.length && !ideas.length && !sessions.length) return;

  // Projects first (tasks/ideas/sessions reference them via FK).
  if (projects.length) {
    const { error: err } = await supabase
      .from('projects')
      .upsert(projects.map((p) => toCloudRow('projects', p, userId)));
    if (err) throw err;
  }
  if (tasks.length) {
    const { error: err } = await supabase
      .from('tasks')
      .upsert(tasks.map((t) => toCloudRow('tasks', t, userId)));
    if (err) throw err;
  }
  if (ideas.length) {
    const { error: err } = await supabase
      .from('ideas')
      .upsert(ideas.map((i) => toCloudRow('ideas', i, userId)));
    if (err) throw err;
  }
  if (sessions.length) {
    const { error: err } = await supabase
      .from('time_sessions')
      .upsert(sessions.map((s) => toCloudRow('time_sessions', s, userId)));
    if (err) throw err;
  }
}

async function pushOutbox(db: SQLiteDatabase, userId: string): Promise<void> {
  const entries = await db.getAllAsync<OutboxEntry>('SELECT * FROM sync_outbox ORDER BY updated_at ASC');
  for (const entry of entries) {
    try {
      if (entry.op === 'delete') {
        const { error } = await supabase
          .from(entry.table_name)
          .delete()
          .eq('id', entry.row_id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const row = await readLocalRow(db, entry.table_name, entry.row_id);
        if (row) {
          const { error } = await supabase.from(entry.table_name).upsert(toCloudRow(entry.table_name, row, userId));
          if (error) throw error;
        }
        // If the row is gone locally (created then deleted before syncing),
        // there's nothing to push - just drop the queued entry below.
      }
      await db.runAsync('DELETE FROM sync_outbox WHERE key = ?', entry.key);
    } catch (err) {
      // Likely offline, or a transient API error. Stop here and leave the
      // rest of the queue for the next sync attempt rather than push out of
      // order.
      console.warn('[sync] push failed for', entry.key, err);
      break;
    }
  }
}

async function pullFromCloud(db: SQLiteDatabase, userId: string): Promise<void> {
  const pending = await db.getAllAsync<{ table_name: SyncTable; row_id: string }>(
    'SELECT table_name, row_id FROM sync_outbox'
  );
  const pendingKeys = new Set(pending.map((p) => `${p.table_name}:${p.row_id}`));

  for (const table of SYNCED_TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
    if (error || !data) continue;

    const remoteIds = new Set(data.map((row: any) => row.id as string));
    for (const row of data) {
      await upsertLocalRow(db, table, row);
    }

    const localIds = await db.getAllAsync<{ id: string }>(`SELECT id FROM ${table}`);
    for (const local of localIds) {
      if (!remoteIds.has(local.id) && !pendingKeys.has(`${table}:${local.id}`)) {
        // Deleted on another device (or cloud) and not something we're
        // still waiting to push - remove it locally too.
        await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, local.id);
      }
    }
  }
}

async function readLocalRow(db: SQLiteDatabase, table: SyncTable, id: string): Promise<Record<string, unknown> | null> {
  return db.getFirstAsync(`SELECT * FROM ${table} WHERE id = ?`, id);
}

function toCloudRow(table: SyncTable, row: Record<string, any>, userId: string): Record<string, unknown> {
  switch (table) {
    case 'projects':
      return {
        id: row.id,
        user_id: userId,
        name: row.name,
        color: row.color,
        is_closed: !!row.is_closed,
      };
    case 'tasks':
      return {
        id: row.id,
        user_id: userId,
        title: row.title,
        description: row.description,
        project_id: row.project_id,
        due_date: row.due_date,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        total_time_seconds: row.total_time_seconds,
      };
    case 'ideas':
      return {
        id: row.id,
        user_id: userId,
        title: row.title,
        body: row.body,
        project_id: row.project_id,
        created_at: row.created_at,
      };
    case 'time_sessions':
      return {
        id: row.id,
        user_id: userId,
        task_id: row.task_id,
        project_id: row.project_id,
        start_time: row.start_time,
        end_time: row.end_time,
        duration_seconds: row.duration_seconds,
      };
  }
}

async function upsertLocalRow(db: SQLiteDatabase, table: SyncTable, row: Record<string, any>): Promise<void> {
  switch (table) {
    case 'projects':
      await db.runAsync(
        'INSERT OR REPLACE INTO projects (id, name, color, is_closed) VALUES (?, ?, ?, ?)',
        row.id,
        row.name,
        row.color,
        row.is_closed ? 1 : 0
      );
      return;
    case 'tasks':
      await db.runAsync(
        `INSERT OR REPLACE INTO tasks
          (id, title, description, project_id, due_date, status, created_at, updated_at, total_time_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id,
        row.title,
        row.description,
        row.project_id,
        row.due_date,
        row.status,
        row.created_at,
        row.updated_at,
        row.total_time_seconds
      );
      return;
    case 'ideas':
      await db.runAsync(
        'INSERT OR REPLACE INTO ideas (id, title, body, project_id, created_at) VALUES (?, ?, ?, ?, ?)',
        row.id,
        row.title,
        row.body,
        row.project_id,
        row.created_at
      );
      return;
    case 'time_sessions':
      await db.runAsync(
        `INSERT OR REPLACE INTO time_sessions
          (id, task_id, project_id, start_time, end_time, duration_seconds)
         VALUES (?, ?, ?, ?, ?, ?)`,
        row.id,
        row.task_id,
        row.project_id,
        row.start_time,
        row.end_time,
        row.duration_seconds
      );
      return;
  }
}
