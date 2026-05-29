const MAX_STRING = 2000;
const MAX_ARRAY = 30;
const MAX_PAYLOAD_CHARS = 24_000;

export function sanitizeText(value: unknown, max = MAX_STRING): string {
  if (value == null) return '';
  const s = String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export function sanitizeStringArray(arr: unknown, maxItems = MAX_ARRAY, maxItem = 200): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .slice(0, maxItems)
    .map((x) => sanitizeText(x, maxItem))
    .filter(Boolean);
}

export function limitPayloadSize(payload: unknown): void {
  const size = JSON.stringify(payload).length;
  if (size > MAX_PAYLOAD_CHARS) {
    throw new Error(`Payload demasiado grande (${size} caracteres; máximo ~${MAX_PAYLOAD_CHARS})`);
  }
}

export function parseJsonFromClaude<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(raw) as T;
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}
