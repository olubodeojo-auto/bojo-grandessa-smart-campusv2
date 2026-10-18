export type ScoreInputState = {
  text: string;
  value: number | null;
  valid: boolean;
};

export function parseScoreInput(text: string): ScoreInputState {
  if (text.trim() === "") {
    return { text, value: null, valid: true };
  }

  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim())) {
    return { text, value: null, valid: false };
  }

  const value = Number(text);
  return Number.isFinite(value)
    ? { text, value, valid: true }
    : { text, value: null, valid: false };
}

export function formatScoreInput(value: number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}
