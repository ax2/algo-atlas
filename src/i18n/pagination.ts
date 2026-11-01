// Prefer a word boundary when a measured page would split an English word.
// Long identifiers/bit strings still split, so every character stays reachable.
export function wordBoundary(chars: string[], limit: number): number {
  if (limit <= 0 || limit >= chars.length) return limit;
  if (
    /[A-Za-z0-9]/.test(chars[limit - 1]) &&
    /[A-Za-z0-9]/.test(chars[limit])
  ) {
    for (let i = limit - 1; i >= Math.max(1, Math.floor(limit / 2)); i--)
      if (/\s/.test(chars[i - 1])) return i;
  }
  return limit;
}
