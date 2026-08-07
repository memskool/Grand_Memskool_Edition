import { useCallback, useRef, useState } from "react";
import { UploadCloud, X, FileText, Film, AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatBytes, inferCategory, validateFile, MAX_FILE_BYTES } from "@/lib/storage";

const ICONS = { note: FileText, video: Film, audio: AudioLines } as const;

export function FileDropzone({
  file,
  onFile,
  progress,
  busy,
  accept,
  hint,
  onError,
}: {
  file: File | null;
  onFile: (file: File | null) => void;
  progress?: number | null;
  busy?: boolean;
  accept?: string;
  hint?: string;
  onError?: (message: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept_ = useCallback(
    (next: File | undefined) => {
      if (!next) return;
      const problem = validateFile(next);
      if (problem) {
        onError?.(problem);
        return;
      }
      onFile(next);
    },
    [onFile, onError],
  );

  if (file) {
    const Icon = ICONS[inferCategory(file)];
    return (
      <div className="rounded-xl border border-border bg-secondary/40 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
          </div>
          {!busy ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => onFile(null)}
              aria-label="Remove file"
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
        {typeof progress === "number" ? (
          <div className="mt-3 space-y-1">
            <Progress value={progress} className="h-1.5" />
            <p className="text-xs text-muted-foreground">{progress}% uploaded</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        accept_(e.dataTransfer.files[0]);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center rounded-xl border border-dashed px-6 py-8 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/40",
      )}
    >
      <UploadCloud className="mb-2 size-6 text-muted-foreground" />
      <p className="text-sm font-medium">Drag &amp; drop a file here</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {hint ?? `or click to browse — up to ${formatBytes(MAX_FILE_BYTES)}`}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => accept_(e.target.files?.[0])}
      />
    </div>
  );
}
