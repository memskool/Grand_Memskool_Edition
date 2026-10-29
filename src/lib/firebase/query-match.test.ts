import { matchAdminFilter } from "./query-match";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  matchAdminFilter({ school_id: "abc", status: "pending" }, "school_id", "==", "abc"),
  "equality matches",
);
assert(
  !matchAdminFilter({ school_id: "abc" }, "school_id", "==", "zzz"),
  "equality rejects other school",
);
assert(
  matchAdminFilter({ status: "pending" }, "status", "in", ["pending", "approved"]),
  "in operator matches",
);
assert(
  matchAdminFilter({ tags: ["teacher", "staff"] }, "tags", "array-contains", "teacher"),
  "array-contains matches",
);

console.log("query-match checks passed");
