
export const IST_OFFSET_MINUTES = 330;
const MS_PER_MINUTE = 60_000;

export function parseHhMm(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function istDateTimeToUtc(date: Date, time?: string | null): Date {
  const minutesIntoDay = (time ? parseHhMm(time) : null) ?? 0;
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(utcMidnight + (minutesIntoDay - IST_OFFSET_MINUTES) * MS_PER_MINUTE);
}

export function formatIst(instant: Date): string {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * MS_PER_MINUTE);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(shifted.getUTCDate())}-${pad(shifted.getUTCMonth() + 1)}-${shifted.getUTCFullYear()} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}
