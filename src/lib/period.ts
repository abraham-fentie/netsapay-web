/** A date picker's YYYY-MM-DD as the API's RFC 3339 bounds: from = start of that day, to = start of the next (exclusive). */
export function dayStart(day: string): string | undefined {
  return day ? new Date(`${day}T00:00:00`).toISOString() : undefined;
}
export function dayEnd(day: string): string | undefined {
  if (!day) return undefined;
  const d = new Date(`${day}T00:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}
