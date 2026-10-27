import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession, useRole } from "@/hooks/useAuth";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  goldSubjectLabel,
  useGoldApplications,
  useReviewGoldApplication,
  useSetGoldCommission,
} from "@/lib/gold-data";

export const Route = createFileRoute("/_authenticated/gold-admin")({
  component: GoldAdminPage,
});

function GoldAdminPage() {
  const { user } = useSession();
  const role = useRole(user);
  const applications = useGoldApplications();
  const review = useReviewGoldApplication();
  const commission = useSetGoldCommission();
  const [note, setNote] = useState("");
  const [bps, setBps] = useState("1000");

  if (role.data && role.data !== "superadmin") {
    return (
      <EmptyState
        icon={Award}
        title="Platform operators only"
        hint="Gold tutor verification is limited to superadmin accounts."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Gold review"
        subtitle="Verify independent tutors. This is not school administration."
      />
      <Panel
        title="Commission"
        description="Stored as basis points. 1000 = 10%. Does not pay tutors out."
      >
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            commission.mutate(Number(bps), {
              onSuccess: () => toast.success("Commission updated"),
              onError: (error) => toast.error(authErrorMessage(error)),
            });
          }}
        >
          <Input
            className="max-w-xs"
            value={bps}
            onChange={(event) => setBps(event.target.value)}
          />
          <Button className="rounded-full">Save</Button>
        </form>
      </Panel>
      <Panel title="Applications" className="mt-6">
        {applications.isLoading ? (
          <ListSkeleton rows={4} />
        ) : (applications.data ?? []).length === 0 ? (
          <EmptyState
            icon={Award}
            title="No Gold tutors yet"
            hint="Submitted applications appear here."
          />
        ) : (
          <ul className="space-y-4">
            {(applications.data ?? []).map((tutor) => (
              <li key={tutor.id} className="rounded-2xl bg-secondary/50 p-4">
                <p className="font-medium">{tutor.full_name}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {tutor.status}
                </p>
                <p className="mt-2 text-sm">{tutor.bio}</p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{tutor.qualifications}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tutor.subjects.map(goldSubjectLabel).join(", ")}
                </p>
                <Textarea
                  className="mt-3"
                  placeholder="Decision note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    className="rounded-full"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate(
                        { tutorId: tutor.id, decision: "approved", note: note || null },
                        {
                          onSuccess: () => toast.success("Tutor approved"),
                          onError: (error) => toast.error(authErrorMessage(error)),
                        },
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() =>
                      review.mutate({ tutorId: tutor.id, decision: "rejected", note: note || null })
                    }
                  >
                    Reject
                  </Button>
                  <Button
                    variant="destructive"
                    className="rounded-full"
                    onClick={() =>
                      review.mutate({
                        tutorId: tutor.id,
                        decision: "suspended",
                        note: note || null,
                      })
                    }
                  >
                    Suspend
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
