import type {
  GoldApplicationStatus,
  GoldClassStatus,
  GoldDelivery,
  GoldEnrolmentStatus,
  GoldLessonStatus,
  GoldLevel,
  GoldSubject,
} from "./policy";

export type GoldTutor = {
  id: string;
  user_id: string;
  full_name: string;
  bio: string;
  subjects: GoldSubject[];
  levels: GoldLevel[];
  languages: string[];
  curriculum: string | null;
  qualifications: string;
  experience_years: number;
  document_urls: string[];
  photo_url: string | null;
  delivery: GoldDelivery[];
  status: GoldApplicationStatus;
  review_note: string | null;
  rating_sum: number;
  rating_count: number;
  earnings_pending_cents: number;
  earnings_currency: string;
  created_at: string;
  updated_at: string;
  decided_at: string | null;
};

export type GoldClass = {
  id: string;
  tutor_id: string;
  tutor_name: string;
  title: string;
  description: string;
  subject: GoldSubject;
  topic: string | null;
  level: GoldLevel;
  curriculum: string | null;
  objectives: string;
  language: string;
  delivery: GoldDelivery;
  price_cents: number;
  currency: string;
  capacity: number;
  enrolled_count: number;
  timezone: string;
  starts_at: string;
  ends_at: string;
  status: GoldClassStatus;
  cancellation_terms: string | null;
  created_at: string;
  updated_at: string;
};

export type GoldEnrolment = {
  id: string;
  class_id: string;
  tutor_id: string;
  learner_id: string;
  status: GoldEnrolmentStatus;
  price_cents: number;
  currency: string;
  order_id: string | null;
  attended: boolean;
  created_at: string;
  updated_at: string;
};

export type GoldLesson = {
  id: string;
  class_id: string;
  tutor_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: GoldLessonStatus;
  classroom_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type GoldResource = {
  id: string;
  class_id: string;
  tutor_id: string;
  title: string;
  storage_path: string | null;
  url: string | null;
  created_at: string;
};

export type GoldReview = {
  id: string;
  class_id: string;
  tutor_id: string;
  learner_id: string;
  rating: number;
  body: string | null;
  reported: boolean;
  created_at: string;
};

export type GoldPolicy = {
  commission_bps: number;
  updated_at: string;
};
