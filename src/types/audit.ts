export type AuditEventType =
  | "account_created"
  | "role_changed"
  | "school_created"
  | "membership_changed"
  | "sensitive_delete"
  | "payment_event"
  | "security";

export type AuditLog = {
  id: string;
  type: AuditEventType;
  actor_id: string | null;
  school_id: string | null;
  target_id: string | null;
  summary: string;
  created_at: string;
};
