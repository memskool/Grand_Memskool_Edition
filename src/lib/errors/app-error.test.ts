import { mapFirebaseMessage } from "./app-error";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assert(
  mapFirebaseMessage("permission-denied") === "You do not have permission to perform this action.",
  "permission",
);
assert(
  !mapFirebaseMessage("FirebaseError: INTERNAL").toLowerCase().includes("internal"),
  "no internal leak",
);
assert(
  mapFirebaseMessage("You are not enrolled in this class.") ===
    "You are not enrolled in this class.",
  "product copy kept",
);
assert(!mapFirebaseMessage("Error:\n    at foo (index.js:1)").includes("at foo"), "stack stripped");
assert(
  mapFirebaseMessage("Failed to get document because the client is offline.") ===
    "Your connection was interrupted. Check your internet and try again.",
  "offline copy",
);
assert(
  mapFirebaseMessage("Firebase: Error (auth/user-not-found).") ===
    "The email or password is incorrect.",
  "missing auth user",
);
assert(
  mapFirebaseMessage("There is no user record corresponding to this identifier.") ===
    "The email or password is incorrect.",
  "user record copy",
);
assert(
  mapFirebaseMessage("auth/configuration-not-found") ===
    "Sign-in isn't available right now. Refresh the page and try again.",
  "auth config",
);
assert(
  mapFirebaseMessage("FirebaseError: [code=not-found]") === "That record could not be found.",
  "generic not-found",
);

console.log("error mapping unit checks passed");
