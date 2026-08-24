import { useState } from "react";
import { toast } from "sonner";
import { HeartHandshake, Unlink } from "lucide-react";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { useSchoolParents, useSchoolStudents } from "@/features/academic/academic-data";
import {
  useLinkParentStudent,
  useSchoolFamilyLinks,
  useUnlinkParentStudent,
} from "@/lib/school-membership";
import { parentLinkId } from "@/lib/parent-link";

export function FamilyLinkPanel({ schoolId }: { schoolId: string | undefined }) {
  const parents = useSchoolParents(schoolId);
  const students = useSchoolStudents(schoolId);
  const links = useSchoolFamilyLinks(schoolId);
  const link = useLinkParentStudent(schoolId);
  const unlink = useUnlinkParentStudent(schoolId);
  const [parentId, setParentId] = useState("");
  const [studentId, setStudentId] = useState("");

  return (
    <div className="space-y-6">
      <Panel
        title="Link a parent to a student"
        description="Parents can only see attendance and released results for children you link here. They cannot link themselves."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
          <Select value={parentId} onValueChange={setParentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select parent" />
            </SelectTrigger>
            <SelectContent>
              {(parents.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select student" />
            </SelectTrigger>
            <SelectContent>
              {(students.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="rounded-full"
            disabled={!parentId || !studentId || link.isPending}
            onClick={() =>
              link.mutate(
                { parentId, studentId },
                {
                  onSuccess: () => {
                    toast.success("Parent and student are linked.");
                    setParentId("");
                    setStudentId("");
                  },
                  onError: (e) => toast.error(authErrorMessage(e)),
                },
              )
            }
          >
            <HeartHandshake className="size-4" />
            Link family
          </Button>
        </div>
      </Panel>

      <Panel title="Linked families" description="Remove a link if it was created by mistake">
        {links.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (links.data ?? []).length ? (
          <ul className="space-y-2">
            {(links.data ?? []).map((row) => {
              const expectedId = parentLinkId(row.parent_id, row.student_id);
              const legacy = row.id !== expectedId;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-xl bg-secondary/50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {row.parentName} → {row.studentName}
                    </p>
                    {legacy ? (
                      <p className="text-xs text-muted-foreground">
                        Older link. Unlink and link again so the parent can read progress.
                      </p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="self-start rounded-full sm:self-auto"
                    disabled={unlink.isPending}
                    onClick={() =>
                      unlink.mutate(row.id, {
                        onSuccess: () => toast.success("Family link removed."),
                        onError: (e) => toast.error(authErrorMessage(e)),
                      })
                    }
                  >
                    <Unlink className="size-4" />
                    Unlink
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={HeartHandshake}
            title="No families linked yet"
            hint="Choose a parent and a student who already belong to this school, then link them."
          />
        )}
      </Panel>
    </div>
  );
}
