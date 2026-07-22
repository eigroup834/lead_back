// Follow-up scheduling is always expressed in IST (Asia/Kolkata, UTC+05:30),
// regardless of the server's own timezone.
//
// Storage shape: `followupDate` is a Prisma @db.Date (returned as UTC midnight of
// that calendar day) and `followupTime` is a plain "HH:mm" wall-clock string. Both
// are read as IST wall-clock values and converted to a real UTC instant here.

export const IST_OFFSET_MINUTES = 330; // +05:30
const MS_PER_MINUTE = 60_000;

/** Parse "HH:mm" into minutes since midnight. Returns null if malformed. */
export function parseHhMm(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/**
 * Combine a date-only value with an IST "HH:mm" wall-clock time into the UTC
 * instant it refers to.
 *
 * The date's UTC calendar components are used directly (a @db.Date column comes
 * back as UTC midnight), so the server's local timezone never shifts the day.
 */
export function istDateTimeToUtc(date: Date, time?: string | null): Date {
  const minutesIntoDay = (time ? parseHhMm(time) : null) ?? 0;
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  // IST wall-clock -> UTC instant: subtract the offset.
  return new Date(utcMidnight + (minutesIntoDay - IST_OFFSET_MINUTES) * MS_PER_MINUTE);
}

/** Format a UTC instant as "DD-MM-YYYY HH:mm" in IST — used in SMS copy. */
export function formatIst(instant: Date): string {
  const shifted = new Date(instant.getTime() + IST_OFFSET_MINUTES * MS_PER_MINUTE);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(shifted.getUTCDate())}-${pad(shifted.getUTCMonth() + 1)}-${shifted.getUTCFullYear()} ` +
    `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`
  );
}
