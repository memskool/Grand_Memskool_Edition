import type { UserProfile } from "@/types/user";
import { isProfileComplete } from "@/features/auth/account-state";

const PROFILE_PREFIX = "memskool.profile.";
const SCHOOL_PREFIX = "memskool.school.";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or private mode — in-memory React Query is enough for this session.
  }
}

export function readCachedProfile(userId: string): UserProfile | null {
  const row = readJson<UserProfile>(PROFILE_PREFIX + userId);
  return isProfileComplete(row) ? row : null;
}

export function writeCachedProfile(profile: UserProfile) {
  if (!profile.id || !isProfileComplete(profile)) return;
  writeJson(PROFILE_PREFIX + profile.id, profile);
}

export function readCachedSchool<T extends { id: string; name?: string }>(
  userId: string,
): T | null {
  const row = readJson<T>(SCHOOL_PREFIX + userId);
  return row && typeof row.id === "string" && row.id ? row : null;
}

export function writeCachedSchool(userId: string, school: { id: string; name?: string }) {
  if (!userId || !school.id) return;
  writeJson(SCHOOL_PREFIX + userId, school);
}

export function clearAccountCache(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_PREFIX + userId);
  window.localStorage.removeItem(SCHOOL_PREFIX + userId);
}
