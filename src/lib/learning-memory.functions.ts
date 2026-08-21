import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const scopeSchema = z.object({ scope: z.enum(["student", "teacher"]).default("student") });

export type RefreshResult = {
  scope: "student" | "teacher";
  dataPoints: number;
  insights: number;
};

type ModelInsight = { title: string; body: string; actionLabel?: string; actionLink?: string };
type ModelPayload = {
  summary?: string;
  strong_topics?: string[];
  weak_topics?: string[];
  learning_style?: string;
  recent_pattern?: string;
  focus_topic?: string;
  insights?: ModelInsight[];
};

const APP_LINKS = [
  "/dashboard",
  "/assessments",
  "/missed-work",
  "/locker",
  "/library",
  "/ai-tutor",
  "/timetable",
] as const;

/** Calls the Lovable AI gateway and returns parsed JSON, or null when the model misbehaves. */
async function askGateway(system: string, prompt: string): Promise<ModelPayload | null> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured for this workspace.");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (res.status === 429) throw new Error("The AI is busy right now. Try again in a moment.");
  if (res.status === 402)
    throw new Error("AI credits are exhausted. Ask the workspace owner to top up.");
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = json.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned) as ModelPayload;
  } catch {
    return null;
  }
}

function cleanList(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, max);
}

function cleanLink(value: unknown): string | null {
  return typeof value === "string" && (APP_LINKS as readonly string[]).includes(value)
    ? value
    : null;
}

/**
 * Rebuilds the signed-in user's AI learning memory from their real academic
 * record, then stores fresh dashboard insights. Students get a learning
 * profile; teachers get class-level teaching insights only.
 */
export const refreshAiInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => scopeSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<RefreshResult> => {
    const { supabase, userId } = context;

    if (data.scope === "teacher") {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, name, subject:subjects(name)")
        .eq("teacher_id", userId);
      const classIds = (classes ?? []).map((c) => c.id);

      const { data: assessments } = await supabase
        .from("assessments")
        .select(
          "id, title, total_points, class_id, submissions:assessment_submissions(auto_score, manual_score, total_points, status)",
        )
        .eq("created_by", userId)
        .order("created_at", { ascending: false })
        .limit(15);

      const { data: attendance } = classIds.length
        ? await supabase
            .from("attendance")
            .select("status, class_id, date")
            .in("class_id", classIds)
            .order("date", { ascending: false })
            .limit(300)
        : { data: [] };

      const payload = await askGateway(
        "You are Memskool's teaching assistant. Reply ONLY with JSON: {\"insights\":[{\"title\":string,\"body\":string,\"actionLabel\":string,\"actionLink\":string}]}. Give at most 3 insights. Each body is one or two short sentences naming a concrete class or topic and a suggested next step. actionLink must be one of /assessments, /timetable, /missed-work, /dashboard. Never invent data that is not in the input.",
        JSON.stringify({ classes, assessments, attendance }),
      );

      const insights = (payload?.insights ?? []).slice(0, 3);
      await supabase.from("ai_insights").delete().eq("user_id", userId).eq("scope", "teacher");
      if (insights.length) {
        await supabase.from("ai_insights").insert(
          insights.map((i) => ({
            user_id: userId,
            scope: "teacher",
            title: String(i.title ?? "Teaching insight").slice(0, 120),
            body: String(i.body ?? "").slice(0, 600),
            action_label: i.actionLabel ? String(i.actionLabel).slice(0, 40) : null,
            action_link: cleanLink(i.actionLink),
          })),
        );
      }
      return {
        scope: "teacher",
        dataPoints: (assessments?.length ?? 0) + (attendance?.length ?? 0),
        insights: insights.length,
      };
    }

    const [subs, missed, attendance, submissions] = await Promise.all([
      supabase
        .from("assessment_submissions")
        .select(
          "auto_score, manual_score, total_points, passed, status, submitted_at, assessment:assessments(title, subject:subjects(name))",
        )
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("missed_work")
        .select("title, category, reviewed, lesson_date")
        .eq("student_id", userId)
        .order("lesson_date", { ascending: false })
        .limit(30),
      supabase
        .from("attendance")
        .select("status, date")
        .eq("student_id", userId)
        .order("date", { ascending: false })
        .limit(60),
      supabase
        .from("submissions")
        .select("grade, status, graded_at, assignment:assignments(title, points)")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    const record = {
      assessments: subs.data ?? [],
      missedWork: missed.data ?? [],
      attendance: attendance.data ?? [],
      assignments: submissions.data ?? [],
    };
    const dataPoints =
      record.assessments.length +
      record.missedWork.length +
      record.attendance.length +
      record.assignments.length;

    if (dataPoints === 0) {
      await supabase.from("learning_profiles").upsert({
        student_id: userId,
        summary:
          "We don't have enough academic activity yet. Attend classes, hand in work and take an assessment — your learning memory builds itself from there.",
        strong_topics: [],
        weak_topics: [],
        data_points: 0,
        generated_at: new Date().toISOString(),
      });
      return { scope: "student", dataPoints: 0, insights: 0 };
    }

    const payload = await askGateway(
      'You are Memskool\'s learning-memory engine for a school student. Reply ONLY with JSON of the shape {"summary":string,"strong_topics":string[],"weak_topics":string[],"learning_style":string,"recent_pattern":string,"focus_topic":string,"insights":[{"title":string,"body":string,"actionLabel":string,"actionLink":string}]}. Write warmly and directly to the student in second person, plainly and briefly. Base every claim on the data given; never invent subjects or scores. Max 4 strong topics, 4 weak topics and 3 insights. actionLink must be one of /assessments, /missed-work, /locker, /library, /ai-tutor, /timetable.',
      JSON.stringify(record),
    );

    const strong = cleanList(payload?.strong_topics, 4);
    const weak = cleanList(payload?.weak_topics, 4);

    await supabase.from("learning_profiles").upsert({
      student_id: userId,
      summary: payload?.summary ? String(payload.summary).slice(0, 800) : null,
      strong_topics: strong,
      weak_topics: weak,
      learning_style: payload?.learning_style ? String(payload.learning_style).slice(0, 200) : null,
      recent_pattern: payload?.recent_pattern ? String(payload.recent_pattern).slice(0, 300) : null,
      focus_topic: payload?.focus_topic ? String(payload.focus_topic).slice(0, 120) : null,
      data_points: dataPoints,
      generated_at: new Date().toISOString(),
    });

    const insights = (payload?.insights ?? []).slice(0, 3);
    await supabase.from("ai_insights").delete().eq("user_id", userId).eq("scope", "student");
    if (insights.length) {
      await supabase.from("ai_insights").insert(
        insights.map((i) => ({
          user_id: userId,
          scope: "student",
          title: String(i.title ?? "Learning insight").slice(0, 120),
          body: String(i.body ?? "").slice(0, 600),
          action_label: i.actionLabel ? String(i.actionLabel).slice(0, 40) : null,
          action_link: cleanLink(i.actionLink),
        })),
      );
    }

    return { scope: "student", dataPoints, insights: insights.length };
  });
