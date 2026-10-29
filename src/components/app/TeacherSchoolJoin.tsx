import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Award, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupSchool, useRequestTeacherJoin, type SchoolSummary } from "@/lib/school-membership";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { refreshAuthClaims } from "@/features/auth/services/auth.service";

export function TeacherSchoolJoin() {
  const join = useRequestTeacherJoin();
  const [schoolCode, setSchoolCode] = useState("");
  const [foundSchool, setFoundSchool] = useState<SchoolSummary | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (schoolCode.trim().length < 3) {
      setFoundSchool(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    const timer = setTimeout(() => {
      lookupSchool(schoolCode)
        .then((school) => {
          if (!cancelled) setFoundSchool(school);
        })
        .catch(() => {
          if (!cancelled) setFoundSchool(null);
        })
        .finally(() => {
          if (!cancelled) setChecking(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [schoolCode]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel
        title="Join a registered school"
        description="Enter the School ID from the institution. They approve you before classes, live lessons and marking unlock."
      >
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const typed = schoolCode.trim();
            void (async () => {
              const school = foundSchool ?? (await lookupSchool(typed));
              if (!school) {
                toast.error("That School ID isn't on Memskool yet. Check it with your school.");
                return;
              }
              setFoundSchool(school);
              join.mutate(typed, {
                onSuccess: async (result) => {
                  await refreshAuthClaims().catch(() => undefined);
                  const schoolName =
                    result && typeof result === "object" && "schoolName" in result
                      ? (result as { schoolName?: string | null }).schoolName
                      : null;
                  toast.success(
                    `Request sent to ${schoolName ?? school.name}. You can still teach on Gold while you wait.`,
                  );
                },
                onError: (error) => toast.error(authErrorMessage(error)),
              });
            })();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="teacher-school-id">School ID</Label>
            <Input
              id="teacher-school-id"
              value={schoolCode}
              onChange={(event) => setSchoolCode(event.target.value)}
              placeholder="e.g. MS-4F91A2"
              autoComplete="off"
            />
            <p className={`text-xs ${foundSchool ? "text-leaf" : "text-muted-foreground"}`}>
              {checking
                ? "Checking School ID…"
                : foundSchool
                  ? `Matched ${foundSchool.name}${foundSchool.city ? ` · ${foundSchool.city}` : ""}`
                  : "Ask the school for the ID they created in School Admin."}
            </p>
          </div>
          <Button type="submit" disabled={join.isPending}>
            <Building2 className="size-4" />
            {join.isPending ? "Sending request…" : "Apply to join"}
          </Button>
        </form>
      </Panel>
      <Panel
        title="Teach on Gold"
        description="Independent tutoring does not need a school. Apply as a Gold tutor, then publish classes."
      >
        <Button asChild variant="gold">
          <Link to="/gold">Open Gold</Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          Gold is separate from any school classroom. Learners discover you after an operator
          approves your tutor application.
        </p>
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-gold">
          <Award className="size-3.5" /> Independent of School ID
        </p>
      </Panel>
    </div>
  );
}
