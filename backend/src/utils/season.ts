/**
 * The show runs each March, so a selling season runs April → March and is named
 * for the year its event falls in: season 2027 = 1 Apr 2026 → 31 Mar 2027.
 */
export const SEASON_START_MONTH = 3; // April, zero-based

export function seasonBounds(year: number): { from: Date; to: Date } {
  return {
    from: new Date(year - 1, SEASON_START_MONTH, 1, 0, 0, 0, 0),
    to: new Date(year, SEASON_START_MONTH, 1, 0, 0, 0, 0),
  };
}

/** Which season a date belongs to. Jan–Mar close out the season named for that year. */
export function seasonOf(d: Date): number {
  return d.getMonth() >= SEASON_START_MONTH ? d.getFullYear() + 1 : d.getFullYear();
}

export const currentSeason = () => seasonOf(new Date());

export const seasonLabel = (year: number) => `Apr ${year - 1} – Mar ${year}`;
