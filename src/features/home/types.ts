import type { HomeLevel, HomeReportReason, HomeSubject, HomeVideoStatus } from "./policy";

export type HomeVideo = {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_kind: "teacher" | "school" | "creator";
  school_id: string | null;
  school_name: string | null;
  title: string;
  description: string;
  subject: HomeSubject;
  topic: string | null;
  level: HomeLevel;
  curriculum: string | null;
  language: string;
  storage_path: string;
  caption_path: string | null;
  thumbnail_path: string | null;
  duration_seconds: number;
  file_size: number;
  mime_type: string;
  status: HomeVideoStatus;
  rights_confirmed: boolean;
  no_identifiable_students: boolean;
  like_count: number;
  save_count: number;
  view_count: number;
  report_count: number;
  rejection_note: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Public card — never includes storage paths. */
export type HomeVideoCard = {
  id: string;
  creator_id: string;
  creator_name: string;
  creator_kind: HomeVideo["creator_kind"];
  school_id: string | null;
  school_name: string | null;
  title: string;
  description: string;
  subject: HomeSubject;
  topic: string | null;
  level: HomeLevel;
  curriculum: string | null;
  language: string;
  duration_seconds: number;
  like_count: number;
  save_count: number;
  view_count: number;
  published_at: string | null;
  playback_url: string | null;
  thumbnail_url: string | null;
  caption_url: string | null;
  liked: boolean;
  saved: boolean;
};

export type HomeReport = {
  id: string;
  video_id: string;
  reporter_id: string;
  reason: HomeReportReason;
  details: string | null;
  status: "open" | "resolved";
  created_at: string;
};

export type HomeSchoolChannel = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  admissions_open: boolean;
};
