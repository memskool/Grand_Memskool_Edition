import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { LESSON_STATUSES, type LessonStatus } from "@/types/academic";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  useCreateLesson,
  useLessonsForTeacher,
  useAddLessonMaterial,
  useLessonMaterials,
} from "@/features/academic/academic-data";
import { useAccess } from "@/lib/access";
import { AskAiButton } from "@/components/app/AskAiButton";
import { buildObjectPath, uploadSchoolObject } from "@/lib/storage";

type ClassOption = { id: string; name: string };

export function LessonManager({
  teacherId,
  classes,
}: {
  teacherId: string;
  classes: ClassOption[];
}) {
  const lessons = useLessonsForTeacher(teacherId);
  const create = useCreateLesson(teacherId);
  const { schoolId } = useAccess();
  const [classId, setClassId] = useState("");
  const [title, setTitle] = useState("");
  const [starts, setStarts] = useState("");
  const [status, setStatus] = useState<LessonStatus>("scheduled");
  const [desc, setDesc] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  if (classes.length === 0) {
    return (
      <Panel title="Lessons" description="Plan learning for the classes you teach">
        <EmptyState icon={BookOpen} title="No class assigned yet" />
      </Panel>
    );
  }

  return (
    <Panel
      title="Lessons"
      description="Draft, schedule and complete lessons. Live classroom links come in a later phase."
    >
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
          <Label htmlFor="ls-title">Title</Label>
          <Input id="ls-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ls-start">Starts</Label>
          <Input
            id="ls-start"
            type="datetime-local"
            value={starts}
            onChange={(e) => setStarts(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as LessonStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LESSON_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="ls-desc">Description</Label>
          <Textarea id="ls-desc" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
      </div>
      <Button
        className="mt-4 rounded-full"
        disabled={create.isPending}
        onClick={() => {
          if (!classId || !title.trim()) {
            toast.error("Pick a class and add a title");
            return;
          }
          create.mutate(
            {
              class_id: classId,
              subject_id: null,
              academic_period_id: null,
              title: title.trim(),
              description: desc.trim() || null,
              starts_at: starts ? new Date(starts).toISOString() : null,
              duration_minutes: 40,
              status,
              curriculum_topic_id: null,
            },
            {
              onSuccess: () => {
                setTitle("");
                setDesc("");
                toast.success("Lesson saved");
              },
              onError: (e) => toast.error(authErrorMessage(e)),
            },
          );
        }}
      >
        <Plus className="mr-2 size-4" /> Save lesson
      </Button>
      <div className="mt-5">
        {lessons.isLoading ? (
          <ListSkeleton rows={2} />
        ) : lessons.data?.length ? (
          <ul className="space-y-2">
            {lessons.data.map((l) => (
              <li key={l.id} className="rounded-2xl bg-secondary/50 px-4 py-3">
                <button type="button" className="w-full text-left" onClick={() => setOpenId(l.id)}>
                  <p className="text-sm font-medium">{l.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <Badge variant="outline" className="mr-2 capitalize">
                      {l.status.replace("_", " ")}
                    </Badge>
                    {l.starts_at ? new Date(l.starts_at).toLocaleString() : "Unscheduled"}
                  </p>
                </button>
                <div className="mt-2">
                  <AskAiButton lessonId={l.id} intent="EXPLAIN" label="Ask AI about this lesson" />
                </div>
                {openId === l.id && schoolId ? (
                  <MaterialRow lessonId={l.id} schoolId={schoolId} teacherId={teacherId} />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={BookOpen} title="No lessons yet" />
        )}
      </div>
    </Panel>
  );
}

function MaterialRow({
  lessonId,
  schoolId,
  teacherId,
}: {
  lessonId: string;
  schoolId: string;
  teacherId: string;
}) {
  const materials = useLessonMaterials(lessonId);
  const add = useAddLessonMaterial(teacherId);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Material title"
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https:// link (optional)"
        />
        <Button
          size="sm"
          onClick={() =>
            add.mutate(
              {
                lesson_id: lessonId,
                title: title.trim() || "Resource",
                kind: url ? "link" : "note",
                url: url.trim() || null,
                storage_path: null,
                file_name: null,
                mime_type: null,
              },
              {
                onSuccess: () => {
                  setTitle("");
                  setUrl("");
                  toast.success("Material attached");
                },
                onError: (e) => toast.error(authErrorMessage(e)),
              },
            )
          }
        >
          Add link
        </Button>
        <Input
          type="file"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const path = `schools/${schoolId}/lessons/${lessonId}/${buildObjectPath("", file.name).replace(/^\//, "")}`;
              await uploadSchoolObject(path, file);
              await add.mutateAsync({
                lesson_id: lessonId,
                title: file.name,
                kind: "file",
                url: null,
                storage_path: path,
                file_name: file.name,
                mime_type: file.type || null,
              });
              toast.success("File attached");
            } catch (err) {
              toast.error(authErrorMessage(err));
            }
          }}
        />
      </div>
      <ul className="text-xs text-muted-foreground">
        {(materials.data ?? []).map((m) => (
          <li key={m.id}>
            {m.title} · {m.kind}
          </li>
        ))}
      </ul>
    </div>
  );
}
