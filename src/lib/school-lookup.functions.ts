import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type SchoolLookupResult = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
} | null;

/**
 * Public School-ID lookup used during signup (no session exists yet).
 * Runs server-side so anonymous clients never get direct database access:
 * only the four non-sensitive fields below leave the server, and only for an
 * exact School-ID match.
 */
export const lookupSchoolByCode = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().trim().min(2).max(64) }).parse(data))
  .handler(async ({ data }): Promise<SchoolLookupResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("schools")
      .select("id, name, city, country")
      .ilike("code", data.code)
      .maybeSingle();
    if (error) throw new Error("Could not verify that School ID right now.");
    return row ?? null;
  });
