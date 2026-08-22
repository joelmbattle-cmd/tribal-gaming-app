export function daysSince(date: Date): number {
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 86400000));
}
