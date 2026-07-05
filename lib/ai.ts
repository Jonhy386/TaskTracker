import * as FileSystem from 'expo-file-system/legacy';
import type { Project } from './types';

export interface ParsedTask {
  title: string;
  description: string | null;
  due_date: string | null;
  project_id: string | null;
}

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

export async function parseTaskText(
  apiKey: string,
  rawText: string,
  openProjects: Project[]
): Promise<ParsedTask> {
  return callGemini(apiKey, [{ text: rawText }], openProjects);
}

export async function parseTaskAudio(
  apiKey: string,
  audioUri: string,
  openProjects: Project[]
): Promise<ParsedTask> {
  const base64Audio = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
  const mimeType = guessAudioMimeType(audioUri);
  return callGemini(
    apiKey,
    [
      { text: 'Parse the spoken task note in this audio recording into the structured fields.' },
      { inlineData: { mimeType, data: base64Audio } },
    ],
    openProjects
  );
}

async function callGemini(
  apiKey: string,
  parts: GeminiPart[],
  openProjects: Project[]
): Promise<ParsedTask> {
  const today = todayIsoDate();
  const projectNames = openProjects.map((p) => p.name);

  const system = `You turn a short natural-language task note (typed or transcribed from speech) into structured fields. Today's date is ${today}. Resolve relative dates ("tomorrow", "Friday", "next week") against that date and always output absolute ISO dates. Only set project_name if it exactly matches one of these open projects: ${
    projectNames.join(', ') || '(none available)'
  }. Omit project_name (empty string) if no project is clearly implied.`;

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
                title: { type: 'STRING', description: 'Short task title' },
                description: {
                  type: 'STRING',
                  description: 'Optional extra detail beyond the title; empty string if none',
                },
                due_date: {
                  type: 'STRING',
                  description:
                    'Absolute ISO date YYYY-MM-DD; empty string if no due date was implied',
                },
                project_name: {
                  type: 'STRING',
                  description: `Must exactly match one of: ${
                    projectNames.join(', ') || '(none available)'
                  }. Empty string if unclear.`,
                },
              },
              required: ['title'],
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

  if (typeof parsed.title !== 'string' || !parsed.title.trim()) {
    throw new ParseError('malformed_response', 'Gemini response had no usable title.');
  }

  const project = openProjects.find(
    (p) => p.name.toLowerCase() === String(parsed.project_name ?? '').toLowerCase()
  );

  return {
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
