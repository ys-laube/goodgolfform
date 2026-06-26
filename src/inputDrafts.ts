export function parseEditableIntegerDraft(value: string): number | null {
  const trimmedValue = value.trim();

  if (!/^-?\d+$/.test(trimmedValue)) {
    return null;
  }

  const parsed = Number.parseInt(trimmedValue, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
