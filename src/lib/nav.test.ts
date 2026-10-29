import { canAccessRoute, mobileTabsForRole, navForRole } from "./nav";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function urls(role: Parameters<typeof navForRole>[0]) {
  return navForRole(role, false, false).map((item) => item.url);
}

const student = urls("student");
assert(student.includes("/locker"), "students keep a locker");
assert(student.includes("/ai-tutor"), "students get the AI tutor");
assert(student.includes("/dream-school"), "students can explore schools");
assert(!student.includes("/home-studio"), "students do not get Home studio in nav");
assert(!student.includes("/school-admin"), "students cannot run a school");

const teacher = urls("teacher");
assert(teacher.includes("/virtual-classroom"), "teachers run live class");
assert(teacher.includes("/home-studio"), "teachers can publish Home clips");
assert(teacher.includes("/gold"), "teachers can use Gold");
assert(!teacher.includes("/locker"), "teachers do not use the student locker");
assert(!teacher.includes("/dream-school"), "teachers do not browse Dream School");
assert(!teacher.includes("/ai-tutor"), "teachers do not get the student AI tutor");
assert(!teacher.includes("/marketplace"), "teachers sell tutoring on Gold, not the bookstore");

const parent = urls("parent");
assert(parent.includes("/dashboard"), "parents have a family dashboard");
assert(parent.includes("/assessments"), "parents see released results");
assert(!parent.includes("/gold"), "parents do not use Gold");
assert(!parent.includes("/locker"), "parents do not have a locker");
assert(!parent.includes("/virtual-classroom"), "parents do not join live class");
assert(!parent.includes("/home-studio"), "parents do not publish");

const school = urls("institution");
assert(school.includes("/school-admin"), "schools run School Admin");
assert(school.includes("/home-studio"), "schools can publish as a channel");
assert(school.includes("/virtual-classroom"), "schools can open live class");
assert(!school.includes("/timetable"), "timetable lives inside School Admin");
assert(!school.includes("/gold"), "schools do not tutor on Gold");
assert(!school.includes("/ai-tutor"), "schools do not get the AI tutor");
assert(!school.includes("/dream-school"), "schools do not browse Dream School");
assert(
  canAccessRoute("institution", "/timetable"),
  "school can still open timetable from School Admin shortcuts",
);
assert(canAccessRoute("institution", "/assessments"), "school can still open assessments");

assert(!canAccessRoute("parent", "/gold"), "parent blocked from Gold");
assert(!canAccessRoute("teacher", "/locker"), "teacher blocked from locker");
assert(canAccessRoute("student", "/ai-tutor"), "student can open AI tutor");
assert(canAccessRoute("teacher", "/gold", true), "pending teacher can still open Gold");
assert(
  !canAccessRoute("teacher", "/virtual-classroom", true),
  "pending teacher cannot host school live class",
);
assert(canAccessRoute("institution", "/school-admin"), "school can open admin");
assert(
  mobileTabsForRole("student", false, false)[0]?.url === "/dashboard",
  "student mobile starts at dashboard",
);
assert(
  mobileTabsForRole("parent", false, false).length === 3,
  "parent mobile bar stays at three tabs",
);
assert(
  mobileTabsForRole("parent", false, false).every((item) =>
    ["/dashboard", "/timetable", "/assessments"].includes(item.url),
  ),
  "parent mobile tabs stay on family tools",
);
assert(
  mobileTabsForRole("institution", false, false).some((item) => item.url === "/school-admin"),
  "school mobile bar includes School Admin",
);

console.log("nav role workspace checks passed");
