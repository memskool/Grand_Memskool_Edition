import { authorizeStorage, isSafeObjectPath } from "./storage-policy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const student = { userId: "s1", role: "student", schoolId: "schA" };
const teacher = { userId: "t1", role: "teacher", schoolId: "schA" };
const outsider = { userId: "x1", role: "teacher", schoolId: "schB" };
const pdf = { size: 1024, contentType: "application/pdf" };

assert(!isSafeObjectPath("schools/schA/../schB/x"), "traversal rejected");
assert(!isSafeObjectPath("/abs/path"), "absolute rejected");
assert(isSafeObjectPath("users/s1/locker/s1/a.pdf"), "normal path accepted");

// Submissions
const sub = "schools/schA/submissions/s1/asg1/a.pdf";
assert(authorizeStorage(student, sub, "write", pdf).ok, "student hands in own work");
assert(!authorizeStorage({ ...student, userId: "s2" }, sub, "write", pdf).ok, "not someone else's");
assert(authorizeStorage(teacher, sub, "read").ok, "teacher reads submissions in school");
assert(!authorizeStorage(outsider, sub, "read").ok, "other school cannot read");
assert(!authorizeStorage({ ...student, userId: "s2" }, sub, "read").ok, "classmate cannot read");

// Lesson / resource files
assert(
  authorizeStorage(teacher, "schools/schA/lessons/l1/a.pdf", "write", pdf).ok,
  "staff uploads lesson file",
);
assert(
  !authorizeStorage(student, "schools/schA/lessons/l1/a.pdf", "write", pdf).ok,
  "students cannot",
);
assert(
  authorizeStorage(student, "schools/schA/resources/note/a.pdf", "read").ok,
  "students read resources",
);

// Size and type limits
assert(
  !authorizeStorage(teacher, "schools/schA/lessons/l1/a.exe", "write", {
    size: 10,
    contentType: "application/x-msdownload",
  }).ok,
  "executables rejected",
);
assert(
  !authorizeStorage(student, "avatars/s1/profile", "write", {
    size: 6 * 1024 * 1024,
    contentType: "image/png",
  }).ok,
  "avatar over 5 MB rejected",
);
assert(
  authorizeStorage(student, "avatars/s1/profile", "write", { size: 1000, contentType: "image/png" })
    .ok,
  "avatar ok",
);
assert(
  !authorizeStorage(student, "avatars/s2/profile", "write", {
    size: 1000,
    contentType: "image/png",
  }).ok,
  "not others' avatar",
);
assert(
  !authorizeStorage(teacher, "schools/schA/lessons/l1/a.pdf", "write").ok,
  "writes need file details",
);

// Locker, home, unknown
assert(authorizeStorage(student, "users/s1/locker/s1/a.pdf", "read").ok, "own locker");
assert(!authorizeStorage(teacher, "users/s1/locker/s1/a.pdf", "read").ok, "locker is private");
assert(!authorizeStorage(student, "home/t1/v1/video", "read").ok, "home bytes private");
assert(
  authorizeStorage({ userId: "a", role: "superadmin", schoolId: null }, "home/t1/v1/video", "read")
    .ok,
  "superadmin reviews",
);
assert(!authorizeStorage(student, "random/file", "read").ok, "unknown locations denied");

console.log("storage-policy unit checks passed");
