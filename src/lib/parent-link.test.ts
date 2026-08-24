import { parentLinkId } from "./parent-link";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(parentLinkId("parentA", "studentB") === "parentA_studentB", "deterministic id");
assert(parentLinkId("a", "a") === "a_a", "same-string still concatenates (rejected in rules)");

console.log("parent-link unit checks passed");
