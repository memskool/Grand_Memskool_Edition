import { Link } from "@tanstack/react-router";
import { Sparkles, RefreshCw, X, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAiInsights,
  useDismissInsight,
  useRefreshAiInsights,
  useLearningProfile,
} from "@/lib/learning-memory";
import { Badge } from "@/components/ui/badge";

/**
 * Memskool AI insight cards. Reads the stored learning memory rather than
 * calling the model on every render — refreshing is an explicit action.
 */
export function AiInsightPanel({
  userId,
  scope,
}: {
  userId: string;
  scope: "student" | "teacher";
}) {
  const insights = useAiInsights(userId, scope);
  const refresh = useRefreshAiInsights(scope);
  const dismiss = useDismissInsight();
  const profile = useLearningProfile(scope === "student" ? userId : undefined);

  const items = insights.data ?? [];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/15 bg-card/60 p-5 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-primary/20 blur-3xl"
      />
      <header className="relative mb-4 flex items-start justify-between gap-3">
        <div>
          <Badge className="mb-2 rounded-full bg-primary/12 text-primary hover:bg-primary/12">
            <Sparkles className="mr-1 size-3" /> Memskool AI
          </Badge>
          <h2 className="font-display text-lg font-semibold">
            {scope === "teacher" ? "Teaching insights" : "Your learning insights"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {scope === "teacher"
              ? "Patterns across your classes, assessments and attendance."
              : "Built from your classwork, results and attendance."}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-full"
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
        >
          <RefreshCw className={`size-4 ${refresh.isPending ? "animate-spin" : ""}`} />
          {refresh.isPending ? "Thinking…" : "Refresh"}
        </Button>
      </header>

      {scope === "student" && profile.data?.summary ? (
        <p className="relative mb-4 rounded-2xl bg-secondary/50 px-4 py-3 text-sm leading-relaxed">
          {profile.data.summary}
        </p>
      ) : null}

      {items.length ? (
        <ul className="relative space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-background/50 px-4 py-3"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Brain className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{i.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{i.body}</p>
                {i.action_link ? (
                  <Link
                    to={i.action_link}
                    className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    {i.action_label ?? "Open"} →
                  </Link>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dismiss insight"
                onClick={() => dismiss.mutate(i.id)}
                className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="relative rounded-2xl border border-dashed border-border/70 px-4 py-6 text-center text-xs text-muted-foreground">
          {insights.isLoading
            ? "Loading your insights…"
            : "No insights yet. Tap Refresh and Memskool AI will study your record."}
        </p>
      )}
    </section>
  );
}
