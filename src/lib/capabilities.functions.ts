import { createServerFn } from "@tanstack/react-start";

export type PlatformCapabilities = {
  liveVideo: boolean;
  tutor: boolean;
  payments: boolean;
  email: boolean;
  insights: boolean;
  /** Cloud Storage bucket reachable (needs the Blaze plan). Gates every upload control. */
  storage: boolean;
};

export const getPlatformCapabilities = createServerFn({ method: "POST" }).handler(
  async (): Promise<PlatformCapabilities> => {
    const { storageAvailable } = await import("@/lib/storage-health.server");
    return {
      liveVideo: Boolean(
        process.env["LIVEKIT_URL"] &&
        process.env["LIVEKIT_API_KEY"] &&
        process.env["LIVEKIT_API_SECRET"],
      ),
      tutor: Boolean(
        process.env["CRANE5_API_URL"]?.trim() && process.env["CRANE5_API_KEY"]?.trim(),
      ),
      payments: Boolean(process.env["FLUTTERWAVE_SECRET_KEY"]?.trim()),
      email: Boolean(process.env["RESEND_API_KEY"]?.trim()),
      insights: Boolean(process.env["LOVABLE_API_KEY"]?.trim()),
      storage: await storageAvailable(),
    };
  },
);
