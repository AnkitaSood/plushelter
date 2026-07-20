/** One roster match returned by the /api/roster-search semantic search: the matched animal's
 * id plus a one-line, in-character reason the intake concierge thinks it fits the query. */
export interface RosterMatch {
  id: string;
  reason: string;
}

export interface RosterSearchResult {
  matches: RosterMatch[];
}

/** Shape the backend returns on a handled failure (mirrors the other functions' error envelope). */
export interface RosterSearchErrorBody {
  error: { code: string; message: string };
}
