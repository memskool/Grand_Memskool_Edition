import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RewardEvent = {
  id: string;
  kind: string;
  points: number;
  note: string | null;
  created_at: string;
};

export const REWARD_LABELS: Record<string, string> = {
  missed_work_reviewed: "Missed work reviewed",
  class_participation: "Live class participation",
  assessment: "Assessment submitted",
  daily_checkin: "Daily check-in",
};

export type Badge = {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  progress: number;
  target: number;
  current: number;
};

export type Level = { rank: number; name: string; into: number; span: number; nextAt: number };

const LEVEL_NAMES = ["Rookie", "Explorer", "Achiever", "Scholar", "Trailblazer", "Legend"];
const LEVEL_SPAN = 200;

export function levelFor(points: number): Level {
  const rank = Math.min(LEVEL_NAMES.length, Math.floor(points / LEVEL_SPAN) + 1);
  const base = (rank - 1) * LEVEL_SPAN;
  return {
    rank,
    name: LEVEL_NAMES[rank - 1] ?? "Legend",
    into: points - base,
    span: LEVEL_SPAN,
    nextAt: base + LEVEL_SPAN,
  };
}

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function useRewardEvents(studentId?: string) {
  return useQuery({
    queryKey: ["reward-events", studentId],
    enabled: !!studentId,
    queryFn: async (): Promise<RewardEvent[]> => {
      const { data, error } = await supabase
        .from("reward_events")
        .select("id, kind, points, note, created_at")
        .eq("student_id", studentId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as RewardEvent[];
    },
  });
}

export function summarise(events: RewardEvent[]) {
  const total = events.reduce((sum, e) => sum + e.points, 0);
  const count = (kind: string) => events.filter((e) => e.kind === kind).length;
  const days = new Set(events.map((e) => e.created_at.slice(0, 10)));
  const nightOwl = events.filter((e) => {
    const hour = new Date(e.created_at).getHours();
    return hour >= 21 || hour < 5;
  }).length;

  const badges: Badge[] = [
    badge(
      "top-contributor",
      "Top Contributor",
      "Join 10 live classes",
      count("class_participation"),
      10,
    ),
    badge(
      "comeback-kid",
      "Comeback Kid",
      "Review 5 missed lessons",
      count("missed_work_reviewed"),
      5,
    ),
    badge("night-owl", "Night Owl", "Study 5 times after 9pm", nightOwl, 5),
    badge(
      "flawless-attendance",
      "Flawless Attendance",
      "Check in on 7 different days",
      days.size,
      7,
    ),
    badge("exam-ace", "Exam Ace", "Submit 5 assessments", count("assessment"), 5),
  ];

  return {
    total,
    badges,
    level: levelFor(total),
    checkedInToday: events.some(
      (e) => e.kind === "daily_checkin" && e.created_at.slice(0, 10) === todayUtc(),
    ),
  };
}

function badge(
  id: string,
  name: string,
  description: string,
  current: number,
  target: number,
): Badge {
  const capped = Math.min(current, target);
  return {
    id,
    name,
    description,
    current: capped,
    target,
    earned: current >= target,
    progress: Math.round((capped / target) * 100),
  };
}

export function useDailyCheckIn(studentId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reward_events").insert({
        student_id: studentId!,
        kind: "daily_checkin",
        points: 5,
        note: "Daily check-in",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reward-events", studentId] }),
  });
}
