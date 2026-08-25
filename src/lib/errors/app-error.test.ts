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

assert(
  mapFirebaseMessage("Could not finish creating this account. Please try again.") ===
    "Could not finish creating this account. Please try again.",
  "signup product copy kept",
);
assert(
  mapFirebaseMessage("Could not load the default credentials. Browse to https://example.com") ===
    "Memskool could not finish signup because the live server is missing Firebase admin credentials.",
  "missing admin credentials",
);
assert(
  mapFirebaseMessage("CSRF token mismatch") === "This page expired. Refresh and try again.",
  "csrf copy",
);
assert(
  mapFirebaseMessage("Firebase: Error (auth/unauthorized-domain).") ===
    "This app address is not allowed for Google or email sign-in yet. Add it in Firebase Authentication authorized domains.",
  "unauthorized domain",
);
assert(
  mapFirebaseMessage("Firebase: Error (auth/popup-blocked).") ===
    "Your browser blocked the Google window. Allow pop-ups for Memskool, then try again.",
  "popup blocked",
);
assert(
  !mapFirebaseMessage(
    `<!doctype html>\n<html>auth/email-already-in-use ${"x".repeat(80)}</html>`,
  ).includes("already exists"),
  "html body is not treated as email-already-in-use",
);

console.log("error mapping unit checks passed");
