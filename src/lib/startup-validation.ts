/**
 * Validates critical environment variables on server startup.
 * This catches configuration errors early instead of at first request.
 * Run this in your server entry point (e.g., src/server.ts or src/start.ts).
 */

export interface StartupValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_SERVER_ENV = [
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "GCLOUD_PROJECT",
] as const;

const OPTIONAL_SERVER_ENV = [
  "FLUTTERWAVE_SECRET_KEY",
  "FLUTTERWAVE_WEBHOOK_HASH",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "RESEND_API_KEY",
  "CRANE5_API_URL",
  "CRANE5_API_KEY",
  "LOVABLE_API_KEY",
  "AFRICSTASLKING_API_KEY",
] as const;

/**
 * Validate server environment on startup.
 * Returns early with warnings if optional services are missing.
 * Throws if any required configuration is missing.
 */
export function validateStartupEnvironment(): StartupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_SERVER_ENV) {
    const value = process.env[varName];
    if (!value) {
      errors.push(
        `Missing required ${varName}. See docs/ENVIRONMENT_SETUP.md or .env.example for configuration.`,
      );
    }
  }

  // Validate Firebase service account JSON if present
  const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (serviceAccountJson && !serviceAccountJson.startsWith("{") && !serviceAccountJson.startsWith("./")) {
    errors.push(
      "FIREBASE_SERVICE_ACCOUNT_JSON appears invalid. " +
        "On Vercel, paste the full JSON object as one line. " +
        "Locally, use a file path like ./path/to/service-account.json",
    );
  }

  // Check optional services
  const optionalServices: Record<string, string[]> = {
    "AI tutor (Crane5)": ["CRANE5_API_URL", "CRANE5_API_KEY"],
    "Payments (Flutterwave)": ["FLUTTERWAVE_SECRET_KEY", "FLUTTERWAVE_WEBHOOK_HASH"],
    "Live video (LiveKit)": ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"],
    Email: ["RESEND_API_KEY"],
    Insights: ["LOVABLE_API_KEY"],
  };

  for (const [service, vars] of Object.entries(optionalServices)) {
    const allMissing = vars.every((v) => !process.env[v]);
    if (allMissing) {
      warnings.push(`${service} is not configured. This feature will be unavailable.`);
    } else {
      const missing = vars.filter((v) => !process.env[v]);
      if (missing.length > 0) {
        warnings.push(
          `${service} is partially configured. Missing: ${missing.join(", ")}. ` +
            `The feature may not work correctly.`,
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log startup validation results. Call this from your server initialization.
 *
 * @example
 * ```ts
 * // In src/server.ts or src/start.ts
 * if (typeof process !== "undefined" && process.env.NODE_ENV === "production") {
 *   logStartupValidation();
 * }
 * ```
 */
export function logStartupValidation(): void {
  const result = validateStartupEnvironment();

  if (!result.isValid) {
    console.error("❌ Startup validation FAILED. Cannot continue.\n");
    result.errors.forEach((err) => console.error(`  • ${err}`));
    console.error("\nFix the errors above and restart the server.");
    if (typeof process !== "undefined") {
      process.exit(1);
    }
  }

  if (result.warnings.length > 0) {
    console.warn("⚠️  Startup warnings:\n");
    result.warnings.forEach((warn) => console.warn(`  • ${warn}`));
  }

  if (result.isValid && result.warnings.length === 0) {
    console.log("✅ Startup validation passed.");
  }
}
