import { fallbackWriteError, isInfrastructureFailure } from "./infra-failure";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(isInfrastructureFailure(new Error("fetch failed")), "fetch failed is infra");
assert(isInfrastructureFailure(new Error("ECONNRESET")), "econnreset is infra");
assert(isInfrastructureFailure(new Error("503 Service Unavailable")), "503 is infra");
assert(
  isInfrastructureFailure(new Error("__dirname is not defined in ES module scope")),
  "dirname crash",
);
assert(!isInfrastructureFailure(new Error("permission-denied")), "permission is not infra");
assert(!isInfrastructureFailure(new Error("Unauthorized")), "unauthorized is not infra");
assert(!isInfrastructureFailure(new Error("Forbidden")), "forbidden is not infra");
assert(
  !isInfrastructureFailure(new Error("not allowed for this school")),
  "not allowed is not infra",
);
assert(!isInfrastructureFailure(new Error("something else")), "unknown defaults closed");

console.log("infra-failure unit checks passed");

const denied = fallbackWriteError(
  new Error("__dirname is not defined in ES module scope"),
  new Error("FirebaseError: Missing or insufficient permissions."),
);
assert(
  denied.message.includes("server could not complete") &&
    denied.message.includes("server runtime error"),
  "fallback denial explains the server failure",
);
assert(
  !denied.message.includes("You do not have permission"),
  "fallback denial is not reported as a permission problem",
);
const passthrough = fallbackWriteError(
  new Error("fetch failed"),
  new Error("That class was not found."),
);
assert(
  passthrough.message === "That class was not found.",
  "non-permission client errors pass through",
);

console.log("fallback-write-error unit checks passed");
