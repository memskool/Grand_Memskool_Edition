import { useState } from "react";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTeacherAssignments,
  useCreateAssignment,
  useDeleteAssignment,
} from "@/lib/assignments-data";
import { formatDateTime } from "@/lib/format";

type ClassOption = { id: string; name: string };

export function TeacherAssignmentPanel({
  teacherId,
  classes,
}: {
  teacherId: string;
  classes: ClassOption[];
}) {
  const classIds = classes.map((c) => c.id);
  const list = useTeacherAssignments(classIds);
  const create = useCreateAssignment(teacherId, classIds);
  const remove = useDeleteAssignment(classIds);

  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [points, setPoints] = useState("100");
  const [description, setDescription] = useState("");

  if (classes.length === 0) {
    return (
      <Panel title="Assignments" description="Set work for the classes you teach">
        <EmptyState
          icon={ClipboardList}
          title="No class assigned yet"
          hint="Once your school assigns you a class, you can post assignments here."
        />
      </Panel>
    );
  }

  const submit = async () => {
    if (!classId || !title.trim()) {
      toast.error("Pick a class and add a title");
      return;
    }
    try {
      await create.mutateAsync({
        class_id: classId,
        title: title.trim(),
        description: description.trim() || null,
        due_at: due ? new Date(due).toISOString() : null,
        points: Number(points) || 0,
      });
      setTitle("");
      setDescription("");
      toast.success("Assignment posted to your class");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post assignment");
    }
  };

  return (
    <Panel title="Assignments" description="Set work for the classes you teach">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger>
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-title">Title</Label>
          <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-due">Due</Label>
          <Input
            id="a-due"
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="a-points">Points</Label>
          <Input
            id="a-points"
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="a-desc">Instructions</Label>
          <Textarea
            id="a-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
      <Button className="mt-4 rounded-full" onClick={submit} disabled={create.isPending}>
        <Plus className="mr-2 size-4" /> Post assignment
      </Button>

      <div className="mt-5">
        {list.isLoading ? (
          <ListSkeleton rows={2} />
        ) : list.data?.length ? (
          <ul className="space-y-2">
            {list.data.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-3 rounded-2xl bg-secondary/50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.class?.name ?? "Class"} ·{" "}
                    {a.due_at ? `due ${formatDateTime(a.due_at)}` : "no due date"} · {a.points} pts
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete assignment"
                  onClick={() => remove.mutate(a.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={ClipboardList} title="No assignments yet" />
        )}
      </div>
    </Panel>
  );
}
