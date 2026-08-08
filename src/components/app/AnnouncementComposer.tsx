import { useEffect, useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { broadcastAnnouncement } from "@/lib/notifications.functions";
import { Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ClassOption = { id: string; name: string };

/**
 * Sends an announcement through the normal notification pipeline: one in-app
 * notification per recipient, which the fan-out trigger turns into email and
 * SMS according to each person's preferences.
 */
export function AnnouncementComposer({
  classes,
  canBroadcastSchoolWide,
}: {
  classes: ClassOption[];
  canBroadcastSchoolWide: boolean;
}) {
  const [target, setTarget] = useState<string>(canBroadcastSchoolWide ? "all" : "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [includeParents, setIncludeParents] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!canBroadcastSchoolWide && target === "all") setTarget(classes[0]?.id ?? "");
  }, [canBroadcastSchoolWide, classes, target]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim() || !target) return;
    setSending(true);
    try {
      const result = await broadcastAnnouncement({
        data: {
          classId: target === "all" ? null : target,
          title: title.trim(),
          body: body.trim(),
          includeParents,
        },
      });
      toast.success(`Announcement sent to ${result.recipients} people`);
      setTitle("");
      setBody("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the announcement");
    } finally {
      setSending(false);
    }
  };

  return (
    <Panel
      title="Announcements"
      description="Delivered in-app, and by email/SMS to everyone who opted in"
    >
      <form onSubmit={send} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Audience</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an audience" />
              </SelectTrigger>
              <SelectContent>
                {canBroadcastSchoolWide ? <SelectItem value="all">Whole school</SelectItem> : null}
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="Mid-term break starts Friday"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ann-body">Message</Label>
          <Textarea
            id="ann-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="Keep it short — SMS recipients see the first 300 characters."
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={includeParents} onCheckedChange={setIncludeParents} />
            Also notify parents
          </label>
          <Button type="submit" className="rounded-full" disabled={sending || !target}>
            {sending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Megaphone className="mr-2 size-4" />
            )}
            Send announcement
          </Button>
        </div>
      </form>
    </Panel>
  );
}
