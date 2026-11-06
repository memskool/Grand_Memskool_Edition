import { isInfrastructureFailure } from "./infra-failure";

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
