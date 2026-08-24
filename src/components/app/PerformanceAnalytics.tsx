import { useMemo } from "react";
import {
  Line,
  LineChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { usePerformanceTrend, type TrendPoint } from "@/lib/assessment-data";
import { Panel, EmptyState } from "@/components/app/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export function PerformanceAnalytics({
  studentId,
  points,
  title = "Performance analytics",
  description = "Grade trend across assessments and subjects.",
}: {
  studentId?: string | undefined;
  points?: TrendPoint[] | undefined;
  title?: string | undefined;
  description?: string | undefined;
}) {
  const trend = usePerformanceTrend(points ? undefined : studentId);
  const data = points ?? trend.data;
  const isLoading = points ? false : trend.isLoading;

  const bySubject = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const p of data ?? []) {
      const entry = map.get(p.subject) ?? { total: 0, count: 0 };
      entry.total += p.percent;
      entry.count += 1;
      map.set(p.subject, entry);
    }
    return Array.from(map.entries()).map(([subject, v]) => ({
      subject,
      average: Math.round(v.total / v.count),
    }));
  }, [data]);

  return (
    <Panel title={title} description={description}>
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : !data?.length ? (
        <EmptyState
          icon={TrendingUp}
          title="No graded assessments yet"
          hint="Charts appear as soon as results are published."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Score over time
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, "Score"]}
                />
                <Line
                  type="monotone"
                  dataKey="percent"
                  stroke="var(--gold)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--gold)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-64">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Average by subject
            </p>
            <ResponsiveContainer width="100%" height="90%">
              <BarChart data={bySubject} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="subject" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v}%`, "Average"]}
                />
                <Bar dataKey="average" fill="var(--primary)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Panel>
  );
}
