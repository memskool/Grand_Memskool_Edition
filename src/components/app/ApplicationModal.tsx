import { useState } from "react";
import { toast } from "sonner";
import { Check, FileText, Loader2, Paperclip } from "lucide-react";
import type { School, ApplicationDocument } from "@/lib/discovery-data";
import { useSubmitApplication } from "@/lib/discovery-data";
import { useLockerItems, CLASS_LEVELS } from "@/lib/content-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function ApplicationModal({
  school,
  userId,
  defaultName,
  defaultEmail,
  open,
  onOpenChange,
}: {
  school: School | null;
  userId?: string | undefined;
  defaultName?: string | undefined;
  defaultEmail?: string | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locker = useLockerItems(userId);
  const submit = useSubmitApplication(userId);

  const [name, setName] = useState(defaultName ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [phone, setPhone] = useState("");
  const [classLevel, setClassLevel] = useState<string>("");
  const [program, setProgram] = useState("");
  const [statement, setStatement] = useState("");
  const [picked, setPicked] = useState<Record<string, ApplicationDocument>>({});

  if (!school) return null;

  const toggleDoc = (id: string, doc: ApplicationDocument) =>
    setPicked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = doc;
      return next;
    });

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter the applicant name");
      return;
    }
    try {
      await submit.mutateAsync({
        school_id: school.id,
        applicant_name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        class_level: classLevel || null,
        intended_program: program.trim() || null,
        personal_statement: statement.trim() || null,
        documents: Object.values(picked),
      });
      toast.success(`Application sent to ${school.name}`);
      onOpenChange(false);
      setStatement("");
      setPicked({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit application");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply to {school.name}</DialogTitle>
          <DialogDescription>
            Complete the admission form and attach supporting documents from your Personal Locker.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="app-name">Applicant name</Label>
            <Input id="app-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-email">Email</Label>
            <Input id="app-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="app-phone">Phone</Label>
            <Input id="app-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Current class level</Label>
            <Select value={classLevel} onValueChange={setClassLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {CLASS_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="app-program">Intended course / program</Label>
            <Input
              id="app-program"
              value={program}
              onChange={(e) => setProgram(e.target.value)}
              placeholder="e.g. Sciences, Computer Engineering"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="app-statement">Personal statement</Label>
            <Textarea
              id="app-statement"
              rows={4}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Tell the admissions team why you're a great fit."
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Paperclip className="size-4" /> Attach from Locker
          </Label>
          {locker.isLoading ? (
            <p className="text-xs text-muted-foreground">Loading your locker…</p>
          ) : locker.data?.length ? (
            <ScrollArea className="h-44 rounded-xl border border-border p-2">
              <div className="space-y-1">
                {locker.data.map((item) => {
                  const selected = !!picked[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        toggleDoc(item.id, {
                          name: item.file_name ?? item.title,
                          path: item.file_path,
                          url: item.url,
                        })
                      }
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                        selected ? "bg-primary/10 text-primary" : "hover:bg-secondary",
                      )}
                    >
                      <FileText className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {selected ? <Check className="size-4" /> : null}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
              No files in your locker yet. Upload documents in the Locker page to attach them here.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submit.isPending}>
            {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Submit application
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
