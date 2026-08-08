import { CalendarPlus, ExternalLink } from "lucide-react";
import { useMyApplications, useMeetings } from "@/lib/discovery-data";
import { ApplicationsTracker } from "@/components/app/ApplicationsTracker";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export function AdmissionsPanel({
  studentId,
  title = "Admission applications",
  description = "Live status of submitted applications",
}: {
  studentId?: string | undefined;
  title?: string;
  description?: string;
}) {
  const applications = useMyApplications(studentId);
  return (
    <Panel title={title} description={description}>
      <ApplicationsTracker
        applications={applications.data ?? []}
        loading={applications.isLoading}
      />
    </Panel>
  );
}

export function MeetingsPanel() {
  const meetings = useMeetings();
  const upcoming = (meetings.data ?? [])
    .filter((m) => new Date(m.scheduled_at) >= new Date())
    .slice(0, 5);

  return (
    <Panel title="School meetings" description="PTA, AGM and parent–teacher sessions">
      {meetings.isLoading ? (
        <ListSkeleton rows={2} />
      ) : upcoming.length ? (
        <ul className="space-y-2">
          {upcoming.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDateTime(m.scheduled_at)} · {m.class?.name ?? "Whole school"}
                  {m.location ? ` · ${m.location}` : ""}
                </p>
              </div>
              <Badge variant="outline" className="uppercase">
                {m.kind}
              </Badge>
              {m.meeting_url ? (
                <a
                  href={m.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Join meeting"
                  className="text-primary"
                >
                  <ExternalLink className="size-4" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={CalendarPlus} title="No meetings scheduled" />
      )}
    </Panel>
  );
}
