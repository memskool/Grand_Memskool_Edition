/**
 * Firestore security-rules regression suite (Phase 4 QA).
 *
 * Runs the real `firestore.rules` in the emulator. Covers the Phase 10 matrix rows that
 * rules decide (cross-tenant isolation, messaging, notifications) and the bugs fixed in
 * this cycle — above all "rules are not filters": a list query must pin the field the
 * rule checks, or Firestore rejects the whole query and the UI shows an empty list.
 *
 *   npm run test:rules        (needs Java 21+; starts and stops the emulator)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  setLogLevel,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

const SCHOOL_A = "ownerA"; // school id == owner uid (platform convention)
const SCHOOL_B = "ownerB";

type Claims = { role: string; schoolId?: string; approved?: boolean };

const people: Record<string, Claims> = {
  ownerA: { role: "institution", schoolId: SCHOOL_A, approved: true },
  teacherA: { role: "teacher", schoolId: SCHOOL_A, approved: true },
  pendingTeacherA: { role: "teacher", schoolId: SCHOOL_A, approved: false },
  studentA: { role: "student", schoolId: SCHOOL_A, approved: true },
  student2A: { role: "student", schoolId: SCHOOL_A, approved: true },
  parentA: { role: "parent", schoolId: SCHOOL_A, approved: true },
  teacherB: { role: "teacher", schoolId: SCHOOL_B, approved: true },
  studentB: { role: "student", schoolId: SCHOOL_B, approved: true },
};

let env: RulesTestEnvironment;
let passed = 0;
const failures: string[] = [];

function as(uid: string): Firestore {
  const claims = people[uid];
  if (!claims) throw new Error(`unknown test user ${uid}`);
  return env.authenticatedContext(uid, claims).firestore() as unknown as Firestore;
}

async function check(name: string, run: () => Promise<unknown>) {
  try {
    await run();
    passed += 1;
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const now = new Date().toISOString();
    const put = (path: string, data: Record<string, unknown>) =>
      setDoc(doc(db, path), { created_at: now, ...data });

    await put(`schools/${SCHOOL_A}`, { name: "School A", owner_id: SCHOOL_A });
    await put(`schools/${SCHOOL_B}`, { name: "School B", owner_id: SCHOOL_B });
    for (const [uid, c] of Object.entries(people)) {
      await put(`users/${uid}`, {
        full_name: uid,
        email: `${uid}@example.test`,
        role: c.role,
        school_id: c.schoolId ?? null,
      });
    }

    await put("classes/classA", { school_id: SCHOOL_A, name: "S1 A", teacher_id: "teacherA" });
    await put("classes/classB", { school_id: SCHOOL_B, name: "S1 B", teacher_id: "teacherB" });
    await put("class_enrollments/classA_studentA", {
      school_id: SCHOOL_A,
      class_id: "classA",
      student_id: "studentA",
      status: "active",
    });
    await put("class_enrollments/classB_studentB", {
      school_id: SCHOOL_B,
      class_id: "classB",
      student_id: "studentB",
      status: "active",
    });
    await put("lessons/lessonA", {
      school_id: SCHOOL_A,
      class_id: "classA",
      teacher_id: "teacherA",
      starts_at: now,
    });
    await put("assignments/asgA", {
      school_id: SCHOOL_A,
      class_id: "classA",
      title: "Essay",
      status: "published",
      points: 20,
    });
    await put("assignments/asgB", {
      school_id: SCHOOL_B,
      class_id: "classB",
      title: "Other school",
      status: "published",
      points: 20,
    });
    await put("submissions/subA", {
      school_id: SCHOOL_A,
      assignment_id: "asgA",
      class_id: "classA",
      student_id: "studentA",
      status: "submitted",
      grade: null,
    });
    await put("assessments/pubA", {
      school_id: SCHOOL_A,
      class_id: "classA",
      created_by: "teacherA",
      title: "Quiz",
      published: true,
      status: "published",
    });
    await put("assessments/draftA", {
      school_id: SCHOOL_A,
      class_id: "classA",
      created_by: "teacherA",
      title: "Draft quiz",
      published: false,
      status: "draft",
    });
    await put("notifications/nStudentA", { user_id: "studentA", title: "Hi", read: false });
    await put("parent_students/parentA_studentA", {
      parent_id: "parentA",
      student_id: "studentA",
      school_id: SCHOOL_A,
    });
    await put("conversations/dm1", {
      kind: "direct",
      created_by: "studentA",
      member_ids: ["studentA", "teacherA"],
      updated_at: now,
    });
    await put("conversation_members/dm1_studentA", { conversation_id: "dm1", user_id: "studentA" });
    await put("conversation_members/dm1_teacherA", { conversation_id: "dm1", user_id: "teacherA" });
    await put("messages/m1", { conversation_id: "dm1", sender_id: "teacherA", body: "Hello" });
  });
}

async function main() {
  // Denied writes are the point of half these checks; keep the SDK from logging each one.
  setLogLevel("silent");
  env = await initializeTestEnvironment({
    projectId: "demo-memskool-rules",
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, "../../firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8085,
    },
  });
  await env.clearFirestore();
  await seed();

  /* ---------- Tenant isolation (matrix row 2) ---------- */
  await check("teacher reads own-school assignment", () =>
    assertSucceeds(getDoc(doc(as("teacherA"), "assignments/asgA"))),
  );
  await check("teacher cannot read another school's assignment", () =>
    assertFails(getDoc(doc(as("teacherA"), "assignments/asgB"))),
  );
  await check("student cannot read another school's class", () =>
    assertFails(getDoc(doc(as("studentA"), "classes/classB"))),
  );
  await check("student cannot list another school's enrolments", () =>
    assertFails(
      getDocs(
        query(collection(as("studentA"), "class_enrollments"), where("school_id", "==", SCHOOL_B)),
      ),
    ),
  );
  await check("user cannot read a profile in another school", () =>
    assertFails(getDoc(doc(as("studentA"), "users/studentB"))),
  );
  await check("pending (unapproved) teacher cannot read school lessons", () =>
    assertFails(getDoc(doc(as("pendingTeacherA"), "lessons/lessonA"))),
  );

  /* ---------- Rules are not filters (this cycle's empty-list bugs) ---------- */
  await check("teacher assessment list pinned to school succeeds", () =>
    assertSucceeds(
      getDocs(
        query(
          collection(as("teacherA"), "assessments"),
          where("school_id", "==", SCHOOL_A),
          where("created_by", "==", "teacherA"),
        ),
      ),
    ),
  );
  await check("teacher assessment list by created_by only is rejected", () =>
    assertFails(
      getDocs(
        query(collection(as("teacherA"), "assessments"), where("created_by", "==", "teacherA")),
      ),
    ),
  );
  await check("student available-assessments query (school + published + status) succeeds", () =>
    assertSucceeds(
      getDocs(
        query(
          collection(as("studentA"), "assessments"),
          where("school_id", "==", SCHOOL_A),
          where("published", "==", true),
          where("status", "==", "published"),
        ),
      ),
    ),
  );
  await check("student assessments query without status is rejected", () =>
    assertFails(
      getDocs(
        query(
          collection(as("studentA"), "assessments"),
          where("school_id", "==", SCHOOL_A),
          where("published", "==", true),
        ),
      ),
    ),
  );
  await check("student cannot read a draft assessment", () =>
    assertFails(getDoc(doc(as("studentA"), "assessments/draftA"))),
  );
  await check("teacher lessons list pinned to school succeeds", () =>
    assertSucceeds(
      getDocs(
        query(
          collection(as("teacherA"), "lessons"),
          where("school_id", "==", SCHOOL_A),
          where("teacher_id", "==", "teacherA"),
        ),
      ),
    ),
  );
  await check("teacher lessons list by teacher only is rejected", () =>
    assertFails(
      getDocs(query(collection(as("teacherA"), "lessons"), where("teacher_id", "==", "teacherA"))),
    ),
  );
  await check("class roster pinned to school succeeds", () =>
    assertSucceeds(
      getDocs(
        query(
          collection(as("teacherA"), "class_enrollments"),
          where("school_id", "==", SCHOOL_A),
          where("class_id", "==", "classA"),
        ),
      ),
    ),
  );

  /* ---------- Assignments & submissions are server-only (Phases 1–2) ---------- */
  await check("teacher cannot create an assignment from the client", () =>
    assertFails(
      addDoc(collection(as("teacherA"), "assignments"), {
        school_id: SCHOOL_A,
        class_id: "classA",
        title: "x",
        status: "published",
      }),
    ),
  );
  await check("student cannot create a submission from the client", () =>
    assertFails(
      setDoc(doc(as("studentA"), "submissions/forged"), {
        school_id: SCHOOL_A,
        assignment_id: "asgA",
        student_id: "studentA",
        status: "submitted",
        submitted_at: "2020-01-01T00:00:00.000Z",
      }),
    ),
  );
  await check("student cannot clear 'late' or self-grade", () =>
    assertFails(updateDoc(doc(as("studentA"), "submissions/subA"), { grade: 20, late: false })),
  );
  await check("student reads own submission", () =>
    assertSucceeds(getDoc(doc(as("studentA"), "submissions/subA"))),
  );
  await check("classmate cannot read another student's submission", () =>
    assertFails(getDoc(doc(as("student2A"), "submissions/subA"))),
  );
  await check("linked parent reads child's submission", () =>
    assertSucceeds(getDoc(doc(as("parentA"), "submissions/subA"))),
  );
  await check("teacher cannot create an assessment from the client", () =>
    assertFails(
      addDoc(collection(as("teacherA"), "assessments"), { school_id: SCHOOL_A, title: "x" }),
    ),
  );

  /* ---------- Notifications & push tokens ---------- */
  await check("user reads own notification", () =>
    assertSucceeds(getDoc(doc(as("studentA"), "notifications/nStudentA"))),
  );
  await check("user cannot read someone else's notification", () =>
    assertFails(getDoc(doc(as("student2A"), "notifications/nStudentA"))),
  );
  await check("user registers own push token", () =>
    assertSucceeds(
      setDoc(doc(as("studentA"), "fcm_tokens/studentA_abc"), {
        user_id: "studentA",
        token: "tok",
        updated_at: new Date().toISOString(),
      }),
    ),
  );
  await check("user cannot register a push token for someone else", () =>
    assertFails(
      setDoc(doc(as("studentA"), "fcm_tokens/student2A_abc"), {
        user_id: "student2A",
        token: "tok",
        updated_at: new Date().toISOString(),
      }),
    ),
  );

  /* ---------- Messaging (matrix row 13) ---------- */
  await check("conversation member reads messages", () =>
    assertSucceeds(
      getDocs(query(collection(as("studentA"), "messages"), where("conversation_id", "==", "dm1"))),
    ),
  );
  await check("non-member cannot read the conversation's messages", () =>
    assertFails(
      getDocs(
        query(collection(as("student2A"), "messages"), where("conversation_id", "==", "dm1")),
      ),
    ),
  );
  await check("member sends a message as themselves", () =>
    assertSucceeds(
      addDoc(collection(as("studentA"), "messages"), {
        conversation_id: "dm1",
        sender_id: "studentA",
        body: "Thanks",
        created_at: new Date().toISOString(),
      }),
    ),
  );
  await check("member cannot send a message as someone else", () =>
    assertFails(
      addDoc(collection(as("studentA"), "messages"), {
        conversation_id: "dm1",
        sender_id: "teacherA",
        body: "Spoofed",
        created_at: new Date().toISOString(),
      }),
    ),
  );
  await check("non-member cannot post into a conversation", () =>
    assertFails(
      addDoc(collection(as("teacherB"), "messages"), {
        conversation_id: "dm1",
        sender_id: "teacherB",
        body: "Intruder",
        created_at: new Date().toISOString(),
      }),
    ),
  );

  await env.cleanup();

  if (failures.length) {
    console.error(`firestore rules: ${passed} passed, ${failures.length} failed`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  console.log(`firestore rules checks passed (${passed})`);
}

main().catch(async (error) => {
  console.error(error);
  await env?.cleanup().catch(() => undefined);
  process.exit(1);
});
