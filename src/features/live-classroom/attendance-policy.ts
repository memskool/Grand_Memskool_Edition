import type { AttendanceStatus } from "@/types/academic";

export type ParticipationSnapshot = {
  connected_at?: string | null;
  duration_ms?: number;
  left_at?: string | null;
  last_connected_at?: string | null;
};

/** Deterministic id so a later live on the same lesson cannot clobber this session. */
export function liveAttendanceDocId(sessionId: string, studentId: string): string {
  return `live_${sessionId}_${studentId}`;
}

export function participationDurationMs(row: ParticipationSnapshot, endedAt: string): number {
  let ms = row.duration_ms ?? 0;
  if (!row.left_at && (row.last_connected_at || row.connected_at)) {
    const start = Date.parse(row.last_connected_at ?? row.connected_at ?? "");
    const end = Date.parse(endedAt);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) ms += end - start;
  }
  return ms;
}

export function markFromParticipation(
  row: ParticipationSnapshot | undefined,
  minSeconds: number,
  nowIso = new Date().toISOString(),
): AttendanceStatus {
  if (!row?.connected_at) return "absent";
  if (participationDurationMs(row, nowIso) < minSeconds * 1000) return "absent";
  return "present";
}
