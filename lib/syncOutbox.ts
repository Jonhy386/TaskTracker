import type { SQLiteDatabase } from 'expo-sqlite';

export const SYNCED_TABLES = ['projects', 'tasks', 'ideas', 'time_sessions'] as const;
export type SyncTable = (typeof SYNCED_TABLES)[number];
export type SyncOp = 'upsert' | 'delete';

export interface OutboxEntry {
  key: string;
  table_name: SyncTable;
  row_id: string;
  op: SyncOp;
  updated_at: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notifyLocalChange() {
  listeners.forEach((fn) => fn());
}

// Called at the end of every mutating query in lib/queries.ts. Queues the
// change for lib/sync.ts to push to Supabase, and pings anything listening
// for local changes (the sync manager debounces an opportunistic push).
export async function enqueueSync(
  db: SQLiteDatabase,
  table: SyncTable,
  rowId: string,
  op: SyncOp
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO sync_outbox (key, table_name, row_id, op, updated_at) VALUES (?, ?, ?, ?, ?)',
    `${table}:${rowId}`,
    table,
    rowId,
    op,
    new Date().toISOString()
  );
  notifyLocalChange();
}
