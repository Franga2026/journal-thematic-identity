const PREFIX = '[sdg-ranking]';

export function sdgLog(message: string, data?: unknown): void {
  if (import.meta.env?.DEV !== false) {
    if (data !== undefined) {
      console.info(PREFIX, message, data);
    } else {
      console.info(PREFIX, message);
    }
  }
}

export function sdgWarn(message: string, data?: unknown): void {
  if (data !== undefined) {
    console.warn(PREFIX, message, data);
  } else {
    console.warn(PREFIX, message);
  }
}
