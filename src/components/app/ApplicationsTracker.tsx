import type { ReactNode } from "react";
import { FileCheck2, Paperclip } from "lucide-react";
import type { SchoolApplication } from "@/lib/discovery-data";
import { EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

const TONE: Record<string, string> = {
  pending: "bg-warning/15 text-warning-foreground",
  under_review: "bg-primary/10 text-primary",
  approved: "bg-success/12 text-success",
  rejected: "bg-destructive/10 text-destructive",
};

export function statusLabel(status: string) {
  return status.replace("_", " ");
}

export function ApplicationsTracker({
  applications,
  loading,
  action,
}: {
  applications: SchoolApplication[];
  loading?: boolean;
  action?: (app: SchoolApplication) => ReactNode;
}) {
  if (loading) return <ListSkeleton rows={3} />;

  if (!applications.length) {
    return (
      <EmptyState
        icon={FileCheck2}
        title="No applications yet"
        hint="Browse the Dream School directory and apply to the schools you're aiming for."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {applications.map((app) => (
        <li key={app.id} className="flex items-start gap-3 rounded-xl bg-secondary/50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{app.school?.name ?? "School"}</p>
            <p className="truncate text-xs text-muted-foreground">
              {app.intended_program || app.class_level || "General admission"} · applied{" "}
              {formatDateTime(app.created_at)}
            </p>
            {app.documents?.length ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="size-3" /> {app.documents.length} document
                {app.documents.length > 1 ? "s" : ""} attached
              </p>
            ) : null}
            {app.review_notes ? (
              <p className="mt-1 text-xs text-muted-foreground">Note: {app.review_notes}</p>
            ) : null}
          </div>
          <span
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${TONE[app.status] ?? "bg-secondary"}`}
          >
            {statusLabel(app.status)}
          </span>
          {action ? action(app) : null}
        </li>
      ))}
    </ul>
  );
}

export function ApplicationBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className="capitalize">
      {statusLabel(status)}
    </Badge>
  );
}
