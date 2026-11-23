import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAccess } from "@/lib/access";
import { useExamMode } from "@/lib/exam-mode";
import { navForRole } from "@/lib/nav";
import { APP_META, TILE_CLASS, quickActionsFor } from "@/lib/launcher";
import { signOut } from "@/features/auth/services/auth.service";
import { cn } from "@/lib/utils";

/** The pill in the top bar. Looks like a search box; opens the palette. */
export function SearchPill({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-border bg-secondary/70 px-4 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary md:max-w-md"
      aria-label="Search Memskool"
    >
      <Search className="size-4 shrink-0" />
      <span className="truncate">Search Memskool</span>
      <kbd className="ml-auto hidden rounded-md border border-border bg-card px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline">
        Ctrl K
      </kbd>
    </button>
  );
}

/**
 * Google-style "search everything": every place you can go and every common job for
 * your role, matched as you type. Pick with Enter or a tap.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role, pendingApproval } = useAccess();
  const examActive = useExamMode();
  const places = navForRole(role, examActive, pendingApproval);
  const actions = examActive ? [] : quickActionsFor(role, pendingApproval);

  const go = (to: string, search?: Record<string, string>) => {
    onOpenChange(false);
    void navigate({ to: to as never, ...(search ? { search: search as never } : {}) });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search features, pages and actions…" />
      <CommandList className="max-h-[min(70vh,28rem)]">
        <CommandEmpty>No match. Try “report card”, “live class” or “timetable”.</CommandEmpty>
        {actions.length ? (
          <CommandGroup heading="Quick actions">
            {actions.map((a) => (
              <CommandItem
                key={`${a.label}-${a.to}`}
                value={`${a.label} ${a.blurb}`}
                onSelect={() => go(a.to, a.search)}
              >
                <span
                  className={cn(
                    "mr-2 flex size-8 items-center justify-center rounded-lg",
                    TILE_CLASS[a.tone],
                  )}
                >
                  <a.icon className="!size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{a.label}</span>
                  <span className="text-xs text-muted-foreground">{a.blurb}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Go to">
          {places.map((p) => {
            const meta = APP_META[p.url];
            return (
              <CommandItem
                key={p.url}
                value={`${p.title} ${meta?.blurb ?? ""} ${p.short ?? ""}`}
                onSelect={() => go(p.url)}
              >
                <span
                  className={cn(
                    "mr-2 flex size-8 items-center justify-center rounded-lg",
                    TILE_CLASS[meta?.tone ?? "navy"],
                  )}
                >
                  <p.icon className="!size-4" />
                </span>
                <span className="flex flex-col">
                  <span className="font-medium">{p.title}</span>
                  {meta ? (
                    <span className="text-xs text-muted-foreground">{meta.blurb}</span>
                  ) : null}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            value="sign out log out"
            onSelect={async () => {
              onOpenChange(false);
              await queryClient.cancelQueries();
              queryClient.clear();
              await signOut();
              void navigate({ to: "/auth", replace: true });
            }}
          >
            <LogOut className="mr-2" /> Sign out
            <CommandShortcut>Account</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
