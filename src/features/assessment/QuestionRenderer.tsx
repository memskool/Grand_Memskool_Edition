import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { EngineQuestionKind } from "./contracts";

export function QuestionRenderer({
  kind,
  options,
  value,
  onChange,
  disabled = false,
}: {
  kind: EngineQuestionKind | string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  if (kind === "long_answer" || kind === "short_answer") {
    return (
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Type your answer…"
        rows={kind === "long_answer" ? 8 : 4}
        aria-label="Your answer"
        disabled={disabled}
      />
    );
  }

  if (kind === "multiple_select") {
    let selected: string[] = [];
    try {
      const parsed = JSON.parse(value || "[]") as unknown;
      selected = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      selected = [];
    }
    return (
      <div className="space-y-2 pl-10" role="group" aria-label="Select all that apply">
        {options.map((opt) => {
          const on = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              disabled={disabled}
              onClick={() => {
                const next = on ? selected.filter((x) => x !== opt) : [...selected, opt];
                onChange(JSON.stringify(next));
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm",
                on ? "border-primary bg-primary/8 font-medium" : "border-border",
              )}
              aria-pressed={on}
            >
              <span
                className={cn(
                  "size-4 rounded-sm border-2",
                  on ? "border-primary bg-primary" : "border-muted-foreground/40",
                )}
              />
              {opt}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 pl-10" role="radiogroup" aria-label="Choose one answer">
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <button
            key={opt}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt)}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm",
              selected
                ? "border-primary bg-primary/8 font-medium"
                : "border-border hover:bg-secondary/60",
            )}
            aria-checked={selected}
            role="radio"
          >
            <span
              className={cn(
                "size-4 shrink-0 rounded-full border-2",
                selected ? "border-primary bg-primary" : "border-muted-foreground/40",
              )}
            />
            {opt}
          </button>
        );
      })}
    </div>
  );
}
