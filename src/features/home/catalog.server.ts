import "@tanstack/react-start/server-only";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin.server";
import { adminGetById, adminSet } from "@/lib/firebase/admin-repo";
import { COLLECTIONS } from "@/lib/firebase/repo";
import type { HomeVideo } from "./types";

const OPS = "ops";
const CATALOG_ID = "home_catalog";
const MODERATION_ID = "home_moderation";

type IdList = { video_ids?: string[]; report_ids?: string[] };

function asIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function loadPublishedHomeIds(): Promise<string[]> {
  const row = await adminGetById<IdList>(OPS, CATALOG_ID);
  return asIds(row?.video_ids);
}

export async function rememberPublishedHomeVideo(videoId: string): Promise<void> {
  await adminSet(
    OPS,
    CATALOG_ID,
    { video_ids: FieldValue.arrayUnion(videoId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function forgetPublishedHomeVideo(videoId: string): Promise<void> {
  await adminSet(
    OPS,
    CATALOG_ID,
    { video_ids: FieldValue.arrayRemove(videoId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function loadPendingHomeIds(): Promise<string[]> {
  const row = await adminGetById<IdList>(OPS, MODERATION_ID);
  return asIds(row?.video_ids);
}

export async function rememberPendingHomeVideo(videoId: string): Promise<void> {
  await adminSet(
    OPS,
    MODERATION_ID,
    { video_ids: FieldValue.arrayUnion(videoId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function forgetPendingHomeVideo(videoId: string): Promise<void> {
  await adminSet(
    OPS,
    MODERATION_ID,
    { video_ids: FieldValue.arrayRemove(videoId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function rememberHomeReport(reportId: string): Promise<void> {
  await adminSet(
    OPS,
    MODERATION_ID,
    { report_ids: FieldValue.arrayUnion(reportId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function forgetHomeReport(reportId: string): Promise<void> {
  await adminSet(
    OPS,
    MODERATION_ID,
    { report_ids: FieldValue.arrayRemove(reportId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function loadOpenHomeReportIds(): Promise<string[]> {
  const row = await adminGetById<IdList>(OPS, MODERATION_ID);
  return asIds(row?.report_ids);
}

export async function rememberCreatorHomeVideo(creatorId: string, videoId: string): Promise<void> {
  await adminSet(
    OPS,
    `home_creator_${creatorId}`,
    { video_ids: FieldValue.arrayUnion(videoId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function loadCreatorHomeIds(creatorId: string): Promise<string[]> {
  const row = await adminGetById<IdList>(OPS, `home_creator_${creatorId}`);
  return asIds(row?.video_ids);
}

export async function rememberSchoolHomeVideo(schoolId: string, videoId: string): Promise<void> {
  await adminSet(
    OPS,
    `home_school_${schoolId}`,
    { video_ids: FieldValue.arrayUnion(videoId), updated_at: new Date().toISOString() },
    true,
  );
}

export async function loadSchoolHomeIds(schoolId: string): Promise<string[]> {
  const row = await adminGetById<IdList>(OPS, `home_school_${schoolId}`);
  return asIds(row?.video_ids);
}

export async function loadHomeVideosByIds(ids: string[]): Promise<HomeVideo[]> {
  if (ids.length === 0) return [];
  const unique = [...new Set(ids)].slice(0, 80);
  const refs = unique.map((id) => adminDb().collection(COLLECTIONS.homeVideos).doc(id));
  const snaps = await adminDb().getAll(...refs);
  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => ({ ...(snap.data() as HomeVideo), id: snap.id }));
}
