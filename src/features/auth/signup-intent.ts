import type { AccountType } from "@/features/auth/account-types";

const KEY = "memskool.signupIntent";

export type SignupIntent = {
  role: AccountType;
  fullName: string;
  schoolCode: string;
  studentCode: string;
  schoolName: string;
};

export function saveSignupIntent(intent: SignupIntent): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(intent));
  } catch {
    // Private mode can block sessionStorage; Google sign-in still works.
  }
}

export function loadSignupIntent(): SignupIntent | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupIntent>;
    if (
      parsed.role !== "student" &&
      parsed.role !== "teacher" &&
      parsed.role !== "parent" &&
      parsed.role !== "institution"
    ) {
      return null;
    }
    return {
      role: parsed.role,
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : "",
      schoolCode: typeof parsed.schoolCode === "string" ? parsed.schoolCode : "",
      studentCode: typeof parsed.studentCode === "string" ? parsed.studentCode : "",
      schoolName: typeof parsed.schoolName === "string" ? parsed.schoolName : "",
    };
  } catch {
    return null;
  }
}

export function clearSignupIntent(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function signupIntentError(intent: SignupIntent): string | null {
  if (!intent.fullName.trim()) return "Enter your name.";
  if (intent.role === "institution" && !intent.schoolName.trim()) {
    return "Enter your school's name.";
  }
  const wanted = intent.schoolCode.trim().toUpperCase();
  if (intent.role === "institution" && wanted && !/^[A-Z0-9-]{3,24}$/.test(wanted)) {
    return "School ID must be 3–24 letters, numbers or dashes.";
  }
  return null;
}

export function signupPayload(intent: SignupIntent) {
  const wanted = intent.schoolCode.trim().toUpperCase();
  return {
    full_name: intent.fullName.trim(),
    role: intent.role,
    school_code: intent.role === "institution" && wanted ? wanted : null,
    student_code: null,
    school_name: intent.role === "institution" ? intent.schoolName.trim() : null,
  };
}
