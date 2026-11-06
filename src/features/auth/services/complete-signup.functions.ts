import { z } from "zod";
import { createServerFn } from "@tanstack/react-start";
import { requireFirebaseAuth } from "@/lib/firebase/require-auth";
import { looksLikeHtmlError } from "@/lib/errors/app-error";

const SignupSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  role: z.enum(["student", "teacher", "parent", "institution"]),
  school_code: z.string().trim().max(24).nullable(),
  student_code: z.string().trim().max(40).nullable(),
  school_name: z.string().trim().max(160).nullable(),
});

function publicSignupError(error: unknown): Error {
  if (error instanceof Error) {
    const first = error.message.split(/\r?\n/)[0]?.trim() ?? "";
    if (
      first &&
      first.length <= 180 &&
      !looksLikeHtmlError(first) &&
      !first.toLowerCase().includes("firebase") &&
      !first.toLowerCase().includes("firestore") &&
      !first.includes("http") &&
      !first.includes("at ")
    ) {
      return new Error(first);
    }
  }
  const raw = error instanceof Error ? error.message : String(error);
  const m = raw.toLowerCase();
  if (
    m.includes("could not load the default credentials") ||
    m.includes("unable to detect a project id") ||
    m.includes("failed to parse private key") ||
    m.includes("invalid_grant") ||
    m.includes("credential")
  ) {
    return new Error(
      "Memskool could not finish signup because the live server is missing Firebase admin credentials.",
    );
  }
  if (
    m.includes("runquery") ||
    m.includes("executepipeline") ||
    m.includes("explain options") ||
    m.includes("failed_precondition")
  ) {
    return new Error("Could not look up that school right now. Try again in a moment.");
  }
  return new Error("Could not finish creating this account. Please try again.");
}

export const completeSignup = createServerFn({ method: "POST" })
  .middleware([requireFirebaseAuth])
  .inputValidator((data: unknown) => SignupSchema.parse(data))
  .handler(async ({ data, context }) => {
    try {
      const { completeSignupHandler } = await import("./complete-signup.server");
      return await completeSignupHandler(data, context);
    } catch (error) {
      console.error(error);
      throw publicSignupError(error);
    }
  });
