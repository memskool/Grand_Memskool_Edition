import { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTeachingClasses } from "@/lib/school-data";
import { useSubjects } from "@/lib/content-data";
import { useCreateAssessment, useQuestionBank, type DraftQuestion } from "@/lib/assessment-data";
import type { AssessmentType } from "@/features/assessment/contracts";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

function parseSelected(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || "[]") as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {
    /* comma list */
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const emptyQuestion = (kind: DraftQuestion["kind"] = "multiple_choice"): DraftQuestion => ({
  kind,
  prompt: "",
  options:
    kind === "multiple_choice" || kind === "multiple_select"
      ? ["", ""]
      : kind === "true_false"
        ? ["True", "False"]
        : [],
  correct_answer: kind === "true_false" ? "True" : "",
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
  const bank = useQuestionBank(teacherId);
  const create = useCreateAssessment();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [timeLimit, setTimeLimit] = useState(30);
  const [passing, setPassing] = useState(50);
  const [published, setPublished] = useState(true);
  const [type, setType] = useState<AssessmentType>("quiz");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [resultsReleased, setResultsReleased] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [availableFrom, setAvailableFrom] = useState("");
  const [availableUntil, setAvailableUntil] = useState("");
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const onLeave = (event: BeforeUnloadEvent) => {
      if (!dirty || create.isPending) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty, create.isPending]);

  const update = (i: number, patch: Partial<DraftQuestion>) => {
    setDirty(true);
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  };

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
      if ((q.kind === "multiple_choice" || q.kind === "true_false") && !q.correct_answer.trim()) {
        toast.error("Every auto-marked question needs a correct answer");
        return;
      }
      if (q.kind === "multiple_select" && parseSelected(q.correct_answer).length === 0) {
        toast.error("Multi-select questions need at least one correct option");
        return;
      }
    }

    try {
      await create.mutateAsync({
        title: title.trim(),
        description,
        class_id: classId,
        subject_id: subjectId || null,
        type,
        time_limit_minutes: type === "practice" ? 0 : Number(timeLimit) || 30,
        passing_score: Number(passing) || 50,
        max_attempts: type === "practice" ? 0 : maxAttempts,
        results_released: type === "practice" ? true : resultsReleased,
        reveal_answers: type === "practice",
        shuffle_questions: shuffleQuestions,
        shuffle_options: shuffleQuestions,
        available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
        available_until: availableUntil ? new Date(availableUntil).toISOString() : null,
        published,
        questions: clean.map((q) => ({
          ...q,
          accepted: q.accepted?.filter((v) => v.trim()) ?? [],
        })),
      });
      toast.success(published ? "Assessment published" : "Draft saved");
      setTitle("");
      setDescription("");
      setQuestions([emptyQuestion()]);
      setDirty(false);
      onCreated?.();
    } catch (e) {
      toast.error(authErrorMessage(e));
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
            onChange={(e) => {
              setDirty(true);
              setTitle(e.target.value);
            }}
            placeholder="Term 2 Algebra Quiz"
            className="mt-1.5"
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="a-desc">Instructions</Label>
          <Textarea
            id="a-desc"
            value={description}
            onChange={(e) => {
              setDirty(true);
              setDescription(e.target.value);
            }}
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
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as AssessmentType)}>
            <SelectTrigger className="mt-1.5" aria-label="Assessment type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="practice">Practice (untimed, retakes)</SelectItem>
              <SelectItem value="quiz">Quiz</SelectItem>
              <SelectItem value="test">Class test</SelectItem>
              <SelectItem value="exam">Formal exam</SelectItem>
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

        <div>
          <Label htmlFor="a-from">Available from</Label>
          <Input
            id="a-from"
            type="datetime-local"
            value={availableFrom}
            onChange={(e) => {
              setDirty(true);
              setAvailableFrom(e.target.value);
            }}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="a-until">Available until</Label>
          <Input
            id="a-until"
            type="datetime-local"
            value={availableUntil}
            onChange={(e) => {
              setDirty(true);
              setAvailableUntil(e.target.value);
            }}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="a-attempts">Max attempts (0 = unlimited)</Label>
          <Input
            id="a-attempts"
            type="number"
            min={0}
            max={20}
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            className="mt-1.5"
          />
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-secondary/50 px-4 py-3 sm:col-span-2">
          <div className="flex items-center gap-3">
            <Switch id="a-pub" checked={published} onCheckedChange={setPublished} />
            <Label htmlFor="a-pub" className="cursor-pointer">
              Publish immediately to enrolled students
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="a-rel" checked={resultsReleased} onCheckedChange={setResultsReleased} />
            <Label htmlFor="a-rel" className="cursor-pointer">
              Release scores as soon as students submit
            </Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="a-sh" checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} />
            <Label htmlFor="a-sh" className="cursor-pointer">
              Shuffle question and option order per attempt
            </Label>
          </div>
        </div>
      </div>

      {(bank.data ?? []).length ? (
        <div className="rounded-2xl border border-border p-4">
          <p className="mb-2 text-sm font-medium">Add from this school’s question bank</p>
          <div className="flex flex-wrap gap-2">
            {(bank.data ?? []).slice(0, 12).map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="outline"
                className="max-w-full rounded-full"
                onClick={() => {
                  setDirty(true);
                  const next: DraftQuestion = {
                    kind: item.kind,
                    prompt: item.prompt,
                    options: item.options ?? [],
                    correct_answer: item.correct_answer ?? "",
                    points: item.points || 1,
                  };
                  if (item.accepted?.length) next.accepted = item.accepted;
                  if (item.topic_id) next.topic_id = item.topic_id;
                  setQuestions((qs) => [...qs, next]);
                }}
              >
                <Plus className="size-3" />
                <span className="truncate">{item.prompt}</span>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

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
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion("multiple_select")])}
            >
              <Plus className="size-4" /> Multi-select
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion("true_false")])}
            >
              <Plus className="size-4" /> True / false
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
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-full"
              onClick={() => setQuestions((qs) => [...qs, emptyQuestion("long_answer")])}
            >
              <Plus className="size-4" /> Essay
            </Button>
          </div>
        </div>

        {questions.map((q, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <GripVertical className="size-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Q{i + 1} · {q.kind.replace("_", " ")}
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

            {q.kind === "true_false" ? (
              <RadioGroup
                className="mt-3"
                value={q.correct_answer}
                onValueChange={(v) => update(i, { correct_answer: v })}
              >
                {["True", "False"].map((opt) => (
                  <div key={opt} className="flex items-center gap-2">
                    <RadioGroupItem value={opt} id={`q${i}${opt}`} />
                    <Label htmlFor={`q${i}${opt}`}>{opt}</Label>
                  </div>
                ))}
              </RadioGroup>
            ) : q.kind === "multiple_select" ? (
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = parseSelected(q.correct_answer);
                  return (
                    <div key={oi} className="flex items-center gap-2">
                      <Checkbox
                        checked={selected.includes(opt)}
                        disabled={!opt.trim()}
                        onCheckedChange={(on) => {
                          const next = on
                            ? [...selected.filter((x) => x !== opt), opt]
                            : selected.filter((x) => x !== opt);
                          update(i, { correct_answer: JSON.stringify(next) });
                        }}
                        aria-label={`Mark option ${oi + 1} correct`}
                      />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...q.options];
                          const old = next[oi];
                          next[oi] = e.target.value;
                          const chosen = parseSelected(q.correct_answer).map((x) =>
                            x === old ? e.target.value : x,
                          );
                          update(i, { options: next, correct_answer: JSON.stringify(chosen) });
                        }}
                        placeholder={`Option ${oi + 1}`}
                        className="h-9"
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="rounded-full"
                        onClick={() => update(i, { options: q.options.filter((_, x) => x !== oi) })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => update(i, { options: [...q.options, ""] })}
                >
                  <Plus className="size-4" /> Add option
                </Button>
                <p className="text-xs text-muted-foreground">Tick every correct option.</p>
              </div>
            ) : q.kind === "multiple_choice" ? (
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
                            correct_answer:
                              q.correct_answer === old ? e.target.value : q.correct_answer,
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
                        onClick={() => update(i, { options: q.options.filter((_, x) => x !== oi) })}
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
                  Select the radio next to the correct option — it auto-grades on the server.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                <Label className="text-xs">
                  {q.kind === "short_answer"
                    ? "Accepted answer"
                    : "Model answer (marking reference)"}
                </Label>
                <Input
                  value={q.correct_answer}
                  onChange={(e) => update(i, { correct_answer: e.target.value })}
                  placeholder="Expected answer"
                />
                {q.kind === "short_answer" ? (
                  <>
                    <Label className="text-xs">Accepted variants (comma separated)</Label>
                    <Input
                      value={(q.accepted ?? []).join(", ")}
                      onChange={(e) =>
                        update(i, {
                          accepted: e.target.value
                            .split(",")
                            .map((v) => v.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="photosynthesis, photo synthesis"
                    />
                  </>
                ) : null}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <Checkbox
                id={`bank${i}`}
                checked={!!q.save_to_bank}
                onCheckedChange={(on) => update(i, { save_to_bank: !!on })}
              />
              <Label htmlFor={`bank${i}`} className="cursor-pointer text-xs">
                Save a copy to this school’s question bank
              </Label>
            </div>
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
