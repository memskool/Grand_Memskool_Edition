import { CloudOff } from "lucide-react";

/** Shown in place of a working file picker while Cloud Storage is switched off. */
export function UploadsOffNote({ what = "Attachments" }: { what?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CloudOff className="size-3.5 shrink-0" />
      {what} are not switched on for Memskool yet.
    </p>
  );
}
