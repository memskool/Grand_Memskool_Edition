import { normalizeShort, type EngineQuestionKind } from "./contracts";

export type MarkableQuestion = {
  id: string;
  kind: EngineQuestionKind;
  points: number;
};

export type AnswerKey = {
  question_id: string;
  correct_answer: string | null;
  accepted?: string[] | null;
};

export function autoMarkQuestion(
  kind: EngineQuestionKind,
  given: string,
  key: AnswerKey | undefined,
): boolean {
  const expected = (key?.correct_answer ?? "").trim();
  const value = (given ?? "").trim();
  if (!value) return false;

  if (kind === "multiple_choice" || kind === "true_false") {
    return value === expected;
  }
  if (kind === "multiple_select") {
    const parse = (raw: string) => {
      try {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed))
          return parsed
            .map(String)
            .map((s) => s.trim())
            .sort();
      } catch {
        /* comma list */
      }
      return raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .sort();
    };
    const a = parse(value);
    const b = parse(expected);
    return a.length > 0 && a.length === b.length && a.every((item, i) => item === b[i]);
  }
  if (kind === "short_answer") {
    const variants = [expected, ...(key?.accepted ?? [])].map(normalizeShort).filter(Boolean);
    const got = normalizeShort(value);
    return variants.includes(got);
  }
  return false;
}

export function isAutoKind(kind: EngineQuestionKind) {
  return kind !== "long_answer";
}

export function needsManualReview(kind: EngineQuestionKind) {
  return kind === "long_answer" || kind === "short_answer";
}
