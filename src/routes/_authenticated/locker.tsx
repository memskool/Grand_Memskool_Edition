import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Archive,
  Plus,
  FolderPlus,
  Folder,
  Search,
  FileText,
  Film,
  AudioLines,
  Download,
  Trash2,
  ChevronLeft,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/useAuth";
import {
  CLASS_LEVELS,
  useSubjects,
  useLockerFolders,
  useLockerItems,
  useCreateFolder,
  useDeleteFolder,
  useCreateLockerItem,
  useDeleteLockerItem,
  type LockerItem,
} from "@/lib/content-data";
import {
  buildObjectPath,
  downloadObject,
  formatBytes,
  inferCategory,
  uploadWithProgress,
  type FileCategory,
} from "@/lib/storage";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { FileDropzone } from "@/components/app/FileDropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
        content:
          "Your personal Memskool vault: organise notes, videos and audio by subject and class level, upload files and search everything instantly.",
      },
      { property: "og:title", content: "Memskool Locker" },
      { property: "og:description", content: "A digital vault for your notes, videos and recordings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LockerPage,
});

const CATEGORY_ICON = { note: FileText, video: Film, audio: AudioLines } as const;
const NONE = "__none__";

function LockerPage() {
  const { user } = useSession();
  const subjects = useSubjects();
  const folders = useLockerFolders(user?.id);
  const items = useLockerItems(user?.id);
  const deleteItem = useDeleteLockerItem();
  const deleteFolder = useDeleteFolder();

  const [tab, setTab] = useState<"all" | FileCategory>("all");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [openFolder, setOpenFolder] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items.data ?? []).filter((item) => {
      if (openFolder && item.folder_id !== openFolder) return false;
      if (tab !== "all" && item.category !== tab) return false;
      if (subjectFilter !== "all" && item.subject_id !== subjectFilter) return false;
      if (levelFilter !== "all" && item.class_level !== levelFilter) return false;
      if (!q) return true;
      return [item.title, item.notes, item.file_name, item.subject?.name]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q));
    });
  }, [items.data, openFolder, tab, subjectFilter, levelFilter, search]);

  const activeFolder = folders.data?.find((f) => f.id === openFolder) ?? null;

  const remove = async (item: LockerItem) => {
    try {
      await deleteItem.mutateAsync({ id: item.id, file_path: item.file_path });
      toast.success("Item removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove that item");
    }
  };

  const download = async (item: LockerItem) => {
    try {
      if (item.file_path) {
        await downloadObject("locker-files", item.file_path, item.file_name);
        return;
      }
      if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  };

  return (
    <>
      <PageHeader
        title="Locker"
        subtitle="Your private vault for notes, videos and recordings."
        action={
          <div className="flex gap-2">
            <NewFolderDialog userId={user?.id} />
            <UploadDialog userId={user?.id} defaultFolder={openFolder} />
          </div>
        }
      />

      {/* Search + filters */}
      <div className="surface-card mb-5 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search everything in your locker"
            className="pl-9"
            aria-label="Search locker"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {(subjects.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Class level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            {CLASS_LEVELS.map((level) => (
              <SelectItem key={level} value={level}>
                {level}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="note">Notes</TabsTrigger>
            <TabsTrigger value="video">Videos</TabsTrigger>
            <TabsTrigger value="audio">Audio</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Folders */}
      {!openFolder ? (
        <Panel title="Folders" description="Organise by subject and class level" className="mb-5">
          {folders.isLoading ? (
            <ListSkeleton rows={2} />
          ) : folders.data?.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {folders.data.map((folder) => (
                <li key={folder.id} className="group flex items-center gap-3 rounded-xl bg-secondary/50 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenFolder(folder.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Folder className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{folder.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[folder.subject?.name, folder.class_level].filter(Boolean).join(" · ") ||
                          "No subject"}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label={`Delete ${folder.name}`}
                    onClick={() => {
                      void deleteFolder
                        .mutateAsync(folder.id)
                        .then(() => toast.success("Folder deleted"))
                        .catch((e: Error) => toast.error(e.message));
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={FolderPlus}
              title="No folders yet"
              hint="Create a folder like “Biology · Form One” to keep things tidy."
            />
          )}
        </Panel>
      ) : null}

      {/* Files */}
      <Panel
        title={activeFolder ? activeFolder.name : "All files"}
        description={
          activeFolder
            ? [activeFolder.subject?.name, activeFolder.class_level].filter(Boolean).join(" · ") ||
              "Files in this folder"
            : "Everything saved in your locker"
        }
      >
        {activeFolder ? (
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 rounded-full"
            onClick={() => setOpenFolder(null)}
          >
            <ChevronLeft className="size-4" /> Back to all folders
          </Button>
        ) : null}

        {items.isLoading ? (
          <ListSkeleton />
        ) : visible.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {visible.map((item) => {
              const Icon = CATEGORY_ICON[(item.category as FileCategory) ?? "note"] ?? FileText;
              return (
                <li key={item.id} className="group flex gap-3 rounded-xl bg-secondary/50 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {item.kind === "link" && !item.file_path ? (
                      <Link2 className="size-4" />
                    ) : (
                      <Icon className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {item.notes ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.notes}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.subject?.name ? (
                        <Badge variant="secondary" className="rounded-full">
                          {item.subject.name}
                        </Badge>
                      ) : null}
                      {item.class_level ? (
                        <Badge variant="outline" className="rounded-full">
                          {item.class_level}
                        </Badge>
                      ) : null}
                      {item.from_missed_work ? (
                        <Badge className="rounded-full">Reviewed catch-up</Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {item.file_size ? `${formatBytes(item.file_size)} · ` : ""}
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    {item.file_path || item.url ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="rounded-full"
                        aria-label={`Open ${item.title}`}
                        onClick={() => void download(item)}
                      >
                        <Download className="size-4" />
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => void remove(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Archive}
            title={search || tab !== "all" ? "Nothing matches those filters" : "Your locker is empty"}
            hint="Upload a file or add a note to get started."
          />
        )}
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------ */

function NewFolderDialog({ userId }: { userId?: string }) {
  const subjects = useSubjects();
  const createFolder = useCreateFolder(userId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [subjectId, setSubjectId] = useState(NONE);
  const [level, setLevel] = useState(NONE);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFolder.mutateAsync({
        name,
        subject_id: subjectId === NONE ? null : subjectId,
        class_level: level === NONE ? null : level,
      });
      setName("");
      setSubjectId(NONE);
      setLevel(NONE);
      setOpen(false);
      toast.success("Folder created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create folder");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <FolderPlus className="size-4" /> New folder
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fd-name">Folder name</Label>
            <Input
              id="fd-name"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Biology"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No subject</SelectItem>
                  {(subjects.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No level</SelectItem>
                  {CLASS_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" className="rounded-full" disabled={createFolder.isPending}>
              Create folder
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ userId, defaultFolder }: { userId?: string; defaultFolder: string | null }) {
  const subjects = useSubjects();
  const folders = useLockerFolders(userId);
  const createItem = useCreateLockerItem(userId);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FileCategory>("note");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [folderId, setFolderId] = useState(defaultFolder ?? NONE);
  const [subjectId, setSubjectId] = useState(NONE);
  const [level, setLevel] = useState(NONE);

  const reset = () => {
    setFile(null);
    setTitle("");
    setUrl("");
    setNotes("");
    setProgress(null);
    setCategory("note");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      let filePath: string | null = null;
      if (file) {
        filePath = buildObjectPath(userId, file.name);
        setProgress(0);
        await uploadWithProgress("locker-files", filePath, file, setProgress);
      }
      await createItem.mutateAsync({
        title: title || file?.name || "Untitled",
        category: file ? inferCategory(file) : category,
        kind: file ? "file" : url ? "link" : "note",
        folder_id: folderId === NONE ? null : folderId,
        subject_id: subjectId === NONE ? null : subjectId,
        class_level: level === NONE ? null : level,
        url: url || null,
        notes: notes || null,
        file_path: filePath,
        file_name: file?.name ?? null,
        file_size: file?.size ?? null,
        mime_type: file?.type ?? null,
      });
      reset();
      setOpen(false);
      toast.success("Saved to your locker");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <Plus className="size-4" /> Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add to locker</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FileDropzone
            file={file}
            onFile={setFile}
            progress={progress}
            busy={busy}
            onError={(m) => toast.error(m)}
          />
          <div className="space-y-2">
            <Label htmlFor="lk-title">Title</Label>
            <Input
              id="lk-title"
              maxLength={120}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={file?.name ?? "Cell structure notes"}
              required={!file}
            />
          </div>
          {!file ? (
            <>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as FileCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="audio">Audio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lk-url">Link (optional)</Label>
                <Input
                  id="lk-url"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://"
                />
              </div>
            </>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Folder</Label>
              <Select value={folderId} onValueChange={setFolderId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No folder</SelectItem>
                  {(folders.data ?? []).map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No subject</SelectItem>
                  {(subjects.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No level</SelectItem>
                  {CLASS_LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lk-notes">Notes</Label>
            <Textarea
              id="lk-notes"
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="rounded-full" disabled={busy}>
              {busy ? "Uploading…" : "Save item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
