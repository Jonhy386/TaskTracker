import * as FileSystem from 'expo-file-system/legacy';
import type { Project } from './types';

export interface ParsedTask {
  type: 'task';
  title: string;
  description: string | null;
  due_date: string | null;
  project_id: string | null;
}

export interface ParsedIdea {
  type: 'idea';
  title: string;
  body: string;
}

export type ParsedCapture = ParsedTask | ParsedIdea;

export type ParseFailureReason = 'no_connection' | 'api_error' | 'malformed_response';

export class ParseError extends Error {
  reason: ParseFailureReason;
  constructor(reason: ParseFailureReason, message: string) {
    super(message);
    this.reason = reason;
  }
}

// Free-tier Gemini model. If this ever gets retired, swap for whatever
// Google's current free "flash" model is at https://ai.google.dev/gemini-api/docs/models
const MODEL = 'gemini-2.5-flash';

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function parseCaptureText(
  apiKey: string,
  rawText: string,
  openProjects: Project[]
): Promise<ParsedCapture> {
  return callGemini(apiKey, [{ text: rawText }], openProjects);
}

export async function parseCaptureAudio(
  apiKey: string,
  audioUri: string,
  openProjects: Project[]
): Promise<ParsedCapture> {
  const base64Audio = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
  const mimeType = guessAudioMimeType(audioUri);
  return callGemini(
    apiKey,
    [
      {
        text: 'Classify and parse the spoken note in this audio recording.',
      },
      { inlineData: { mimeType, data: base64Audio } },
    ],
    openProjects
  );
}

async function callGemini(
  apiKey: string,
  parts: GeminiPart[],
  openProjects: Project[]
): Promise<ParsedCapture> {
  const today = todayIsoDate();
  const projectNames = openProjects.map((p) => p.name);

  const system = `You process a short natural-language note (typed or transcribed from speech). First decide capture_type:
- "task": something actionable to do, often with an implied deadline (e.g. "review the report by Friday", "call the supplier tomorrow").
- "idea": a thought, reflection, or note to remember that isn't a to-do item (e.g. "maybe we should redesign the onboarding flow", "the client mentioned they prefer weekly check-ins").

If capture_type is "task": fill title, description, due_date, project_name. Today's date is ${today}. Resolve relative dates ("tomorrow", "Friday", "next week") against that date and always output absolute ISO dates. Only set project_name if it exactly matches one of these open projects: ${
    projectNames.join(', ') || '(none available)'
  }. Leave description/due_date/project_name as empty strings if not applicable.

If capture_type is "idea": fill idea_title (a short, clear title you generate) and idea_body (a cleaned-up, coherent write-up of what was said — fix false starts, filler words, and rambling into clear prose that preserves the actual meaning; don't add anything that wasn't said). Leave title/description/due_date/project_name as empty strings.`;

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'OBJECT',
              properties: {
                capture_type: { type: 'STRING', enum: ['task', 'idea'] },
                title: { type: 'STRING', description: 'Task title; empty string for ideas' },
                description: {
                  type: 'STRING',
                  description: 'Optional task detail beyond the title; empty string if none/idea',
                },
                due_date: {
                  type: 'STRING',
                  description:
                    'Absolute ISO date YYYY-MM-DD for a task; empty string if none/idea',
                },
                project_name: {
                  type: 'STRING',
                  description: `For a task, must exactly match one of: ${
                    projectNames.join(', ') || '(none available)'
                  }. Empty string if unclear or idea.`,
                },
                idea_title: {
                  type: 'STRING',
                  description: 'Short generated title for an idea; empty string for tasks',
                },
                idea_body: {
                  type: 'STRING',
                  description:
                    'Cleaned-up, coherent write-up of an idea; empty string for tasks',
                },
              },
              required: ['capture_type'],
            },
          },
        }),
      }
    );
  } catch {
    throw new ParseError('no_connection', 'Network request failed.');
  }

  if (!response.ok) {
    throw new ParseError('api_error', `API returned status ${response.status}`);
  }

  let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  try {
    data = await response.json();
  } catch {
    throw new ParseError('malformed_response', 'Response was not valid JSON.');
  }

  const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawJson) {
    throw new ParseError('malformed_response', 'No content in Gemini response.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new ParseError('malformed_response', 'Gemini did not return valid JSON.');
  }

  if (parsed.capture_type === 'idea') {
    if (typeof parsed.idea_title !== 'string' || !parsed.idea_title.trim()) {
      throw new ParseError('malformed_response', 'Gemini idea response had no usable title.');
    }
    return {
      type: 'idea',
      title: parsed.idea_title.trim(),
      body: typeof parsed.idea_body === 'string' ? parsed.idea_body.trim() : '',
    };
  }

  if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
    throw new ParseError('malformed_response', 'Gemini task response had no usable title.');
  }

  const project = openProjects.find(
    (p) => p.name.toLowerCase() === String(parsed.project_name ?? '').toLowerCase()
  );

  return {
    type: 'task',
    title: parsed.title.trim(),
    description:
      typeof parsed.description === 'string' && parsed.description.trim()
        ? parsed.description.trim()
        : null,
    due_date: isValidDateString(parsed.due_date) ? parsed.due_date : null,
    project_id: project?.id ?? null,
  };
}

function guessAudioMimeType(uri: string): string {
  const ext = uri.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'm4a':
    case 'mp4':
      return 'audio/mp4';
    case 'wav':
      return 'audio/wav';
    case 'aac':
      return 'audio/aac';
    case 'caf':
      return 'audio/x-caf';
    default:
      return 'audio/mp4';
  }
}

function todayIsoDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateString(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
