import { autoMarkQuestion, isAutoKind, needsManualReview } from "./marking";
import { normalizeShort, shuffle } from "./contracts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  autoMarkQuestion("multiple_choice", "B", { question_id: "1", correct_answer: "B" }),
  "MC match",
);
assert(
  !autoMarkQuestion("multiple_choice", "A", { question_id: "1", correct_answer: "B" }),
  "MC miss",
);
assert(
  autoMarkQuestion("true_false", "True", { question_id: "1", correct_answer: "True" }),
  "TF match",
);
assert(
  autoMarkQuestion("multiple_select", JSON.stringify(["A", "C"]), {
    question_id: "1",
    correct_answer: JSON.stringify(["C", "A"]),
  }),
  "multi-select order independent",
);
assert(
  !autoMarkQuestion("multiple_select", JSON.stringify(["A"]), {
    question_id: "1",
    correct_answer: JSON.stringify(["A", "C"]),
  }),
  "multi-select incomplete",
);
assert(
  autoMarkQuestion("short_answer", "Photo-synthesis!", {
    question_id: "1",
    correct_answer: "photosynthesis",
    accepted: ["photo synthesis"],
  }),
  "short answer normalized",
);
assert(
  !autoMarkQuestion("long_answer", "essay", { question_id: "1", correct_answer: "essay" }),
  "essay not auto",
);
assert(isAutoKind("multiple_choice") && needsManualReview("long_answer"), "kind flags");
assert(normalizeShort("  Hello,  WORLD!! ") === "hello world", "normalize");
assert(shuffle(["a", "b", "c"], 7).length === 3, "shuffle length");
assert(
  JSON.stringify(shuffle(["a", "b", "c"], 11)) === JSON.stringify(shuffle(["a", "b", "c"], 11)),
  "shuffle stable",
);

console.log("assessment marking unit checks passed");
