import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Library,
  BookOpen,
  Search,
  Upload,
  Download,
  Trash2,
  FlaskConical,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import {
  CLASS_LEVELS,
  LIBRARY_CATEGORIES,
  useSubjects,
  useLibraryBooks,
  useCreateLibraryBook,
  useDeleteLibraryBook,
  type LibraryBook,
} from "@/lib/content-data";
import { buildObjectPath, downloadObject, formatBytes, uploadWithProgress } from "@/lib/storage";
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

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — Memskool" },
      {
        name: "description",
        content:
          "Browse and download course materials, books and research projects shared across your school on Memskool.",
      },
      { property: "og:title", content: "Library — Memskool" },
      {
        property: "og:description",
        content: "Course materials, books and research projects in one shelf.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

const NONE = "__none__";
const CATEGORY_ICON: Record<string, typeof BookOpen> = {
  course_material: GraduationCap,
  book: BookOpen,
  research: FlaskConical,
};

function LibraryPage() {
  const { user } = useSession();
  const role = useRole(user ?? null);
  const canManage = role.data === "teacher" || role.data === "admin";

  const books = useLibraryBooks();
  const subjects = useSubjects();
  const deleteBook = useDeleteLibraryBook();

  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [downloading, setDownloading] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (books.data ?? []).filter((b) => {
      if (tab !== "all" && b.category !== tab) return false;
      if (subjectFilter !== "all" && b.subject?.name !== subjectFilter) return false;
      if (!q) return true;
      return [b.title, b.author, b.description, b.file_name, b.subject?.name]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [books.data, tab, subjectFilter, search]);

  const download = async (book: LibraryBook) => {
    if (!book.file_path) return;
    setDownloading(book.id);
    try {
      await downloadObject("library-files", book.file_path, book.file_name);
      toast.success("Download started");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Library"
        subtitle="Shared course materials, books and research projects."
        action={canManage ? <UploadBookDialog userId={user?.id} /> : undefined}
      />

      <div className="surface-card mb-5 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the library"
            className="pl-9"
            aria-label="Search library"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All subjects</SelectItem>
            {(subjects.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {LIBRARY_CATEGORIES.map((c) => (
              <TabsTrigger key={c.value} value={c.value}>
                {c.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Panel title="Shelf" description="Everything your school has published">
        {books.isLoading ? (
          <ListSkeleton />
        ) : visible.length ? (
          <ul className="grid grid-cols-2 gap-x-5 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((book) => {
              const Icon = CATEGORY_ICON[book.category] ?? BookOpen;
              return (
                <li key={book.id}>
                  <button
                    type="button"
                    onClick={() => setActive(book)}
                    className="group w-full text-left"
                  >
                    <span
                      className="relative flex aspect-[3/4] w-full flex-col justify-between overflow-hidden rounded-2xl bg-ink p-4 text-ink-foreground transition-transform group-hover:-translate-y-1"
                      style={{ boxShadow: "var(--shadow-soft)" }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-0 w-1.5 bg-ink-foreground/15"
                      />
                      <Icon className="size-5 opacity-70" />
                      <span className="min-w-0">
                        <span className="line-clamp-3 block font-display text-sm font-bold leading-snug">
                          {book.title}
                        </span>
                        <span className="mt-1 block truncate text-[11px] text-ink-muted">
                          {book.author || book.subject?.name || "Memskool"}
                        </span>
                      </span>
                    </span>
                    <span className="mt-2.5 block truncate text-sm font-medium">{book.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {book.subject?.name ?? "General"}
                      {book.class_level ? ` · ${book.class_level}` : ""}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Library}
            title={
              search || tab !== "all" ? "Nothing matches those filters" : "The library is empty"
            }
            hint={
              canManage
                ? "Upload a course material, book or research project to get the shelf started."
                : "Your teachers will publish materials here soon."
            }
          />
        )}
      </Panel>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {active ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl">{active.title}</DialogTitle>
              </DialogHeader>
              <div className="flex gap-4">
                <div
                  className="flex aspect-[3/4] w-28 shrink-0 items-end rounded-2xl bg-ink p-3 text-ink-foreground"
                  style={{ boxShadow: "var(--shadow-soft)" }}
                >
                  <span className="line-clamp-4 font-display text-xs font-bold leading-snug">
                    {active.title}
                  </span>
                </div>
                <div className="min-w-0 space-y-2">
                  {active.author ? (
                    <p className="text-sm text-muted-foreground">by {active.author}</p>
                  ) : null}
                  <div className="flex flex-wrap gap-1.5">
                    {active.subject?.name ? (
                      <Badge variant="secondary" className="rounded-full">
                        {active.subject.name}
                      </Badge>
                    ) : null}
                    {active.class_level ? (
                      <Badge variant="outline" className="rounded-full">
                        {active.class_level}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {active.file_size ? `${formatBytes(active.file_size)} · ` : ""}
                    Added {formatDate(active.created_at)}
                  </p>
                </div>
              </div>
              {active.description ? (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {active.description}
                </p>
              ) : null}
              <DialogFooter className="gap-2 sm:justify-between">
                {canManage ? (
                  <Button
                    variant="ghost"
                    className="rounded-full text-destructive"
                    onClick={() => {
                      const target = active;
                      setActive(null);
                      void deleteBook
                        .mutateAsync({ id: target.id, file_path: target.file_path })
                        .then(() => toast.success("Removed from library"))
                        .catch((e: Error) => toast.error(e.message));
                    }}
                  >
                    <Trash2 className="size-4" /> Remove
                  </Button>
                ) : (
                  <span />
                )}
                {active.file_path ? (
                  <Button
                    className="rounded-full"
                    disabled={downloading === active.id}
                    onClick={() => void download(active)}
                  >
                    <Download className="size-4" />
                    {downloading === active.id ? "Preparing…" : "Download"}
                  </Button>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */

function UploadBookDialog({ userId }: { userId: string | undefined }) {
  const subjects = useSubjects();
  const createBook = useCreateLibraryBook(userId);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("course_material");
  const [subjectId, setSubjectId] = useState(NONE);
  const [level, setLevel] = useState(NONE);

  const reset = () => {
    setFile(null);
    setTitle("");
    setAuthor("");
    setDescription("");
    setProgress(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    try {
      let filePath: string | null = null;
      if (file) {
        filePath = buildObjectPath(category, file.name);
        setProgress(0);
        await uploadWithProgress("library-files", filePath, file, setProgress);
      }
      await createBook.mutateAsync({
        title: title || file?.name || "Untitled",
        author: author || null,
        description: description || null,
        category,
        subject_id: subjectId === NONE ? null : subjectId,
        class_level: level === NONE ? null : level,
        file_path: filePath,
        file_name: file?.name ?? null,
        file_size: file?.size ?? null,
        mime_type: file?.type ?? null,
      });
      reset();
      setOpen(false);
      toast.success("Published to the library");
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
          <Upload className="size-4" /> Upload material
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload to library</DialogTitle>
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
            <Label htmlFor="lb-title">Title</Label>
            <Input
              id="lb-title"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lb-author">Author</Label>
              <Input
                id="lb-author"
                maxLength={100}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIBRARY_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
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
              <Label>Class level</Label>
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
            <Label htmlFor="lb-desc">Description</Label>
            <Textarea
              id="lb-desc"
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="rounded-full" disabled={busy}>
              {busy ? "Uploading…" : "Publish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
