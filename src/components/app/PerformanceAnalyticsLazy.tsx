import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The charts library (recharts) is ~380 KB. Dashboards render instantly without it: the
 * chunk is only fetched when the analytics panel is about to scroll into view.
 */
const Real = lazy(() =>
  import("@/components/app/PerformanceAnalytics").then((m) => ({
    default: m.PerformanceAnalytics,
  })),
);

type Props = ComponentProps<typeof Real>;

function Placeholder() {
  return <Skeleton className="h-72 w-full rounded-[1.4rem]" />;
}

export function PerformanceAnalytics(props: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  return (
    <div ref={ref}>
      {near ? (
        <Suspense fallback={<Placeholder />}>
          <Real {...props} />
        </Suspense>
      ) : (
        <Placeholder />
      )}
    </div>
  );
}
