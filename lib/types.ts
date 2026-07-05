export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'cancelled';

export type PendingCaptureFailureReason = 'no_connection' | 'api_error' | 'malformed_response';

export interface Project {
  id: string;
  name: string;
  color: string;
  is_closed: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string;
  due_date: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
  total_time_seconds: number;
}

export interface TimeSession {
  id: string;
  task_id: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number | null;
}

export interface PendingCapture {
  id: string;
  raw_text: string;
  audio_uri: string | null;
  failure_reason: PendingCaptureFailureReason;
  created_at: string;
  resolved: number;
}

export interface ParsedTaskFields {
  title: string;
  description: string | null;
  due_date: string | null;
  project_id: string | null;
}
