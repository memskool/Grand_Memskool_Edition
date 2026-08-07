import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useSession } from "@/hooks/useAuth";
import { useNotifications, useMarkNotificationRead } from "@/lib/discovery-data";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { user } = useSession();
  const notifications = useNotifications(user?.id);
  const markRead = useMarkNotificationRead(user?.id);

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="Notifications">
          <Bell className="size-[18px]" />
          {unread > 0 ? (
            <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-primary" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {unread ? `${unread} unread` : "You're all caught up"}
          </p>
        </div>
        <ScrollArea className="max-h-80">
          {items.length ? (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.link ?? "/dashboard"}
                    onClick={() => !n.read && markRead.mutate(n.id)}
                    className={cn(
                      "block px-4 py-3 text-left transition hover:bg-secondary",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <p className="text-sm font-medium capitalize">{n.title}</p>
                    {n.body ? <p className="text-xs text-muted-foreground">{n.body}</p> : null}
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">No notifications yet</p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
