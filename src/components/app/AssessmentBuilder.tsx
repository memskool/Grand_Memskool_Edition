import { useState } from "react";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeachingClasses } from "@/lib/school-data";
import { useCreateAssessment, type DraftQuestion } from "@/lib/assessment-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subjects").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

const emptyQuestion = (kind: DraftQuestion["kind"] = "multiple_choice"): DraftQuestion => ({
  kind,
  prompt: "",
  options: kind === "multiple_choice" ? ["", ""] : [],
  correct_answer: "",
  points: 1,
});

export function AssessmentBuilder({
  teacherId,
  onCreated,
}: {
  teacherId?: string | undefined;
  onCreated?: (() => void) | undefined;
}) {
  const classes = useTeachingClasses(teacherId);
  const subjects = useSubjects();
  const create = useCreateAssessment(teacherId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [passing, setPassing] = useState(50);
  const [published, setPublished] = useState(true);
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);

  const update = (i: number, patch: Partial<DraftQuestion>) =>
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));

  const totalPoints = questions.reduce((s, q) => s + (Number(q.points) || 0), 0);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Give the assessment a title");
      return;
    }
    if (!classId) {
      toast.error("Choose a class to assign this to");
      return;
    }
    const clean = questions.filter((q) => q.prompt.trim());
    if (!clean.length) {
      toast.error("Add at least one question");
      return;
    }
    for (const q of clean) {
      if (q.kind === "multiple_choice" && !q.correct_answer.trim()) {
        toast.error("Every multiple-choice question needs a correct option selected");
        return;
      }
    }

    try {
      await create.mutateAsync({
        title: title.trim(),
        description,
        class_id: classId,
        subject_id: subjectId || null,
        time_limit_minutes: Number(timeLimit) || 30,
        passing_score: Number(passing) || 50,
        published,
        questions: clean,
      });
      toast.success(published ? "Assessment published" : "Draft saved");
      setTitle("");
      setDescription("");
      setQuestions([emptyQuestion()]);
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save assessment");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="a-title">Title</Label>
          <Input
            id="a-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Term 2 Algebra Quiz"
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="a-desc">Instructions</Label>
          <Textarea
            id="a-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Answer all questions. No calculators."
            className="mt-1.5"
          />
        </div>

        <div>
          <Label>Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select class" />
            </SelectTrigger>
            <SelectContent>
              {(classes.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Subject</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {(subjects.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="a-time">Time limit (minutes)</Label>
          <Input
            id="a-time"
            type="number"
            min={1}
            value={timeLimit}
            onChange={(e) => setTimeLimit(Number(e.target.value))}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="a-pass">Passing score (%)</Label>
          <Input
            id="a-pass"
            type="number"
            min={0}
            max={100}
            value={passing}
            onChange={(e) => setPassing(Number(e.target.value))}
            className="mt-1.5"
          />
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3 sm:col-span-2">
          <Switch id="a-pub" checked={published} onCheckedChange={setPublished} />
          <Label htmlFor="a-pub" className="cursor-pointer">
            Publish immediately to enrolled students
          </Label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold">
            Questions <span className="text-muted-foreground">· {totalPoints} pts</span>
          </h3>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion("multiple_choice")])}
            >
              <Plus className="size-4" /> Multiple choice
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion("short_answer")])}
            >
              <Plus className="size-4" /> Short answer
            </Button>
          </div>
        </div>

        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Q{i + 1} · {q.kind === "multiple_choice" ? "Multiple choice" : "Short answer"}
              </span>
              <div className="flex-1" />
              <Input
                type="number"
                min={1}
                value={q.points}
                onChange={(e) => update(i, { points: Number(e.target.value) })}
                className="h-8 w-20"
                aria-label="Points"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="rounded-full"
                onClick={() => setQuestions((qs) => qs.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <Textarea
              value={q.prompt}
              onChange={(e) => update(i, { prompt: e.target.value })}
              placeholder="Type the question…"
            />

            {q.kind === "multiple_choice" ? (
              <div className="mt-3 space-y-2">
                <RadioGroup
                  value={q.correct_answer}
                  onValueChange={(v) => update(i, { correct_answer: v })}
                >
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <RadioGroupItem value={opt} disabled={!opt.trim()} id={`q${i}o${oi}`} />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...q.options];
                          const old = next[oi];
                          next[oi] = e.target.value;
                          update(i, {
                            options: next,
                            correct_answer: q.correct_answer === old ? e.target.value : q.correct_answer,
                          });
                        }}
                        placeholder={`Option ${oi + 1}`}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() =>
                          update(i, { options: q.options.filter((_, x) => x !== oi) })
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </RadioGroup>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => update(i, { options: [...q.options, ""] })}
                >
                  <Plus className="size-4" /> Add option
                </Button>
                <p className="text-xs text-muted-foreground">
                  Select the radio next to the correct option — it auto-grades instantly.
                </p>
              </div>
            ) : (
              <div className="mt-3">
                <Label className="text-xs">Model answer (for your marking reference)</Label>
                <Input
                  value={q.correct_answer}
                  onChange={(e) => update(i, { correct_answer: e.target.value })}
                  placeholder="Expected answer"
                  className="mt-1.5"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <Button onClick={submit} disabled={create.isPending} className="rounded-full">
        {create.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {published ? "Publish assessment" : "Save draft"}
      </Button>
    </div>
  );
}
