import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Archive, Plus, Link2, StickyNote, FileText } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useAuth";
import { useMyLocker } from "@/lib/school-data";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/locker")({
  head: () => ({
    meta: [
      { title: "Locker — Memskool" },
      {
        name: "description",
        content: "Keep your notes, links and school files organised in your personal Memskool locker.",
      },
      { property: "og:title", content: "Memskool Locker" },
      { property: "og:description", content: "Your personal space for notes, links and files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LockerPage,
});

const ICONS = { note: StickyNote, link: Link2, file: FileText } as const;

function LockerPage() {
  const { user } = useSession();
  const locker = useMyLocker(user?.id);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"note" | "link" | "file">("note");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("locker_items").insert({
      owner_id: user.id,
      title,
      kind,
      url: url || null,
      notes: notes || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setUrl("");
    setNotes("");
    setOpen(false);
    toast.success("Saved to your locker");
    void qc.invalidateQueries({ queryKey: ["locker"] });
  };

  return (
    <>
      <PageHeader
        title="Locker"
        subtitle="Everything you saved, in one private place."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-full">
                <Plus className="size-4" /> Add item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add to locker</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="lk-title">Title</Label>
                  <Input
                    id="lk-title"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="note">Note</SelectItem>
                      <SelectItem value="link">Link</SelectItem>
                      <SelectItem value="file">File</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {kind !== "note" ? (
                  <div className="space-y-2">
                    <Label htmlFor="lk-url">URL</Label>
                    <Input
                      id="lk-url"
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="lk-notes">Notes</Label>
                  <Textarea
                    id="lk-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <Button type="submit" className="rounded-full" disabled={saving}>
                    Save item
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <Panel title="Saved items" description="Only you can see what's in your locker">
        {locker.isLoading ? (
          <ListSkeleton />
        ) : locker.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {locker.data.map((item) => {
              const Icon = ICONS[(item.kind as keyof typeof ICONS) ?? "note"] ?? StickyNote;
              return (
                <li key={item.id} className="flex gap-3 rounded-xl bg-secondary/50 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.notes ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {item.notes}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Archive}
            title="Your locker is empty"
            hint="Add your first note, link or file to keep it handy."
          />
        )}
      </Panel>
    </>
  );
}
