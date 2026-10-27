import { useEffect, useMemo, useState } from "react";
import { HomePlayer } from "@/components/app/HomePlayer";
import { EmptyState, ListSkeleton, ServiceNotice } from "@/components/app/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clapperboard } from "lucide-react";
import {
  HOME_LEVELS,
  HOME_SUBJECTS,
  homeSubjectLabel,
  useHomeFeed,
  useSetHomeInterests,
} from "@/lib/home-data";
import { useSession } from "@/hooks/useAuth";
import { toast } from "sonner";
import { loadHomeFeed } from "@/features/home/home.functions";
import type { HomeVideoCard } from "@/features/home/types";
import { authErrorMessage } from "@/lib/errors/auth-errors";

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of ["data", "result", "payload", "value"]) {
      if (key in obj && obj[key] !== undefined) return unwrap<T>(obj[key]);
    }
  }
  return raw as T;
}

export function HomeFeed({ initialVideoId }: { initialVideoId?: string }) {
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("all");
  const [level, setLevel] = useState("all");
  const [active, setActive] = useState(0);
  const [extra, setExtra] = useState<HomeVideoCard[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const feed = useHomeFeed({ query, subject, level });
  const interests = useSetHomeInterests();

  const items = useMemo(() => {
    const base = [...(feed.data?.items ?? []), ...extra];
    if (!initialVideoId) return base;
    return [...base].sort(
      (a, b) => Number(b.id === initialVideoId) - Number(a.id === initialVideoId),
    );
  }, [feed.data?.items, extra, initialVideoId]);

  useEffect(() => {
    setExtra([]);
    setCursor(feed.data?.nextCursor ?? null);
    setActive(0);
  }, [feed.data?.nextCursor, query, subject, level]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((value) => Math.min(items.length - 1, value + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((value) => Math.max(0, value - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length]);

  async function loadMore() {
    if (!cursor) return;
    try {
      const payload = unwrap<{ items: HomeVideoCard[]; nextCursor: string | null }>(
        await loadHomeFeed({
          data: {
            query: query || undefined,
            subject: subject as never,
            level: level as never,
            cursor,
          },
        }),
      );
      setExtra((current) => [...current, ...(payload.items ?? [])]);
      setCursor(payload.nextCursor ?? null);
    } catch (error) {
      toast.error(authErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap gap-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title, topic, creator or school"
          className="min-w-[12rem] flex-1"
        />
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {HOME_SUBJECTS.map((item) => (
              <SelectItem key={item} value={item}>
                {homeSubjectLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={level} onValueChange={setLevel}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {HOME_LEVELS.map((item) => (
              <SelectItem key={item} value={item}>
                {homeSubjectLabel(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {feed.data?.ranking ? (
        <ServiceNotice title="How this feed is ordered">{feed.data.ranking}</ServiceNotice>
      ) : null}
      {user ? (
        <div className="flex flex-wrap gap-2">
          {HOME_SUBJECTS.slice(0, 8).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                interests.mutate([item], {
                  onSuccess: () =>
                    toast.success(`We’ll boost ${homeSubjectLabel(item)} in your feed.`),
                })
              }
            >
              {homeSubjectLabel(item)}
            </Button>
          ))}
        </div>
      ) : null}

      {feed.isLoading ? (
        <ListSkeleton rows={3} />
      ) : feed.isError ? (
        <EmptyState
          icon={Clapperboard}
          title="Home could not load"
          hint="Check your connection and try again."
          action={
            <Button className="rounded-full" onClick={() => void feed.refetch()}>
              Retry
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Clapperboard}
          title="No approved videos yet"
          hint="Public educational clips appear here after a teacher or school submits them and a platform operator approves them."
        />
      ) : (
        <div
          className="flex max-h-[86dvh] snap-y snap-mandatory flex-col items-center gap-6 overflow-y-auto pb-8"
          onScroll={(event) => {
            const node = event.currentTarget;
            const kids = [...node.children];
            const mid = node.scrollTop + node.clientHeight / 2;
            const index = kids.findIndex((child) => {
              const top = (child as HTMLElement).offsetTop;
              const height = (child as HTMLElement).offsetHeight;
              return mid >= top && mid <= top + height;
            });
            if (index >= 0) setActive(index);
          }}
        >
          {items.map((video, index) => (
            <HomePlayer key={video.id} video={video} active={index === active} />
          ))}
          {cursor ? (
            <Button variant="outline" onClick={() => void loadMore()}>
              Load more
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
