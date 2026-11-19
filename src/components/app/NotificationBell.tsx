import { useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { pushState, registerFcmToken, type PushState } from "@/lib/firebase/fcm";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSession } from "@/hooks/useAuth";
import { useNotifications, useMarkNotificationRead } from "@/lib/discovery-data";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Notification links may carry a query (`/messages?c=…`); the router wants path + search. */
function splitLink(link: string | null): { to: string; search: Record<string, string> } {
  const [path, query] = (link || "/dashboard").split("?", 2);
  return {
    to: path || "/dashboard",
    search: query ? Object.fromEntries(new URLSearchParams(query)) : {},
  };
}

export function NotificationBell() {
  const { user } = useSession();
  const notifications = useNotifications(user?.id);
  const markRead = useMarkNotificationRead(user?.id);

  // Web push: refresh this browser's token silently when alerts are already allowed;
  // otherwise offer a "Turn on alerts" button (never prompt on page load).
  const [push, setPush] = useState<PushState>("unsupported");
  const [enabling, setEnabling] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    void pushState().then((state) => {
      if (!alive) return;
      setPush(state);
      if (state === "granted") void registerFcmToken().catch(() => undefined);
    });
    return () => {
      alive = false;
    };
  }, [user?.id]);
  const enablePush = async () => {
    setEnabling(true);
    try {
      const state = await registerFcmToken({ prompt: true });
      setPush(state);
      if (state === "granted") toast.success("Alerts are on for this device");
      else if (state === "denied")
        toast.error("Alerts are blocked. Allow notifications for memskool.com in your browser.");
    } catch {
      toast.error("Could not turn on alerts on this device. Try again later.");
    } finally {
      setEnabling(false);
    }
  };

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  // Announce notifications that arrive while the app is open (live class started, approval,
  // missed work…) — after the first load, so the toast never replays old history.
  const seenIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!notifications.data) return;
    if (!seenIds.current) {
      seenIds.current = new Set(notifications.data.map((n) => n.id));
      return;
    }
    for (const n of notifications.data) {
      if (seenIds.current.has(n.id)) continue;
      seenIds.current.add(n.id);
      if (!n.read) {
        toast(n.title, {
          description: n.body ?? undefined,
          action: n.link
            ? { label: "Open", onClick: () => window.location.assign(n.link!) }
            : undefined,
        });
      }
    }
  }, [notifications.data]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Notifications"
        >
          <Bell className="size-[18px]" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-gold" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {unread ? `${unread} unread` : "You're all caught up"}
          </p>
          {push === "default" ? (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-8 w-full rounded-full text-xs"
              disabled={enabling}
              onClick={() => void enablePush()}
            >
              <BellRing className="mr-1.5 size-3.5" />
              {enabling ? "Turning on…" : "Turn on alerts for this device"}
            </Button>
          ) : null}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.isLoading ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">Loading…</p>
          ) : notifications.isError ? (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Couldn’t load notifications. Open Settings if this keeps happening.
            </p>
          ) : items.length ? (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    {...(splitLink(n.link) as { to: string })}
                    onClick={() => !n.read && markRead.mutate(n.id)}
                    className={cn(
                      "block px-4 py-3 text-left transition hover:bg-secondary",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <p className="text-sm font-medium capitalize">{n.title}</p>
                    {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(n.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              No notifications yet
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
