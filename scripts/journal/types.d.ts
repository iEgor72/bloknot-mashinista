export interface Shift {
  id: string;
  start_msk: string;
  end_msk: string;
  created_at: string;
  pending?: boolean;
  [key: string]: string | number | boolean | null | undefined;
}
export interface JournalConflict {
  id: string;
  base: Shift | null;
  local: Shift | null;
  remote: Shift | null;
}
export interface JournalState {
  schema: 2;
  userId: string;
  generation: number;
  revision: number | null;
  shifts: Shift[];
  baseShifts: Shift[];
  pending: boolean;
  status: string;
  error: string;
  lastSyncAt: string;
  needsReview: boolean;
  conflicts: JournalConflict[];
  legacyJournal?: Shift[] | null;
  legacyBackup?: Record<string, string | null>;
}
export interface JournalResponse {
  sid: string;
  revision: number;
  shifts: Shift[];
}
