import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Panel, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  HOME_LEVELS,
  HOME_SUBJECTS,
  assertHomeCaption,
  assertHomeThumb,
  homeSubjectLabel,
  readVideoDuration,
  uploadHomeFile,
  useCreateHomeDraft,
  useMyHomeVideos,
  useSubmitHomeDraft,
  useUnpublishHome,
} from "@/lib/home-data";
import { MAX_HOME_DURATION_SECONDS, MIN_HOME_DURATION_SECONDS } from "@/features/home/policy";
import { useRole, useSession } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/home-studio")({
  head: () => ({ meta: [{ title: "Publish on Home — Memskool" }] }),
  component: HomeStudioPage,
});

function HomeStudioPage() {
  const { user } = useSession();
  const role = useRole(user);
  const mine = useMyHomeVideos();
  const create = useCreateHomeDraft();
  const submit = useSubmitHomeDraft();
  const unpublish = useUnpublishHome();
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState<(typeof HOME_SUBJECTS)[number]>("biology");
  const [level, setLevel] = useState<(typeof HOME_LEVELS)[number]>("lower_secondary");
  const [topic, setTopic] = useState("");
  const [asSchool, setAsSchool] = useState(false);
  const [rights, setRights] = useState(false);
  const [noStudents, setNoStudents] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const video = (form.elements.namedItem("video") as HTMLInputElement).files?.[0];
    const thumb = (form.elements.namedItem("thumb") as HTMLInputElement).files?.[0];
    const caption = (form.elements.namedItem("caption") as HTMLInputElement).files?.[0];
    if (!video) {
      toast.error("Choose a video file.");
      return;
    }
    try {
      const durationSeconds = await readVideoDuration(video);
      if (
        durationSeconds < MIN_HOME_DURATION_SECONDS ||
        durationSeconds > MAX_HOME_DURATION_SECONDS
      ) {
        toast.error("Home clips must be between 5 seconds and 3 minutes.");
        return;
      }
      const draft = await create.mutateAsync({
        title,
        description,
        subject,
        topic: topic.trim() || null,
        level,
        curriculum: null,
        language: "English",
        durationSeconds,
        publishAsSchool: asSchool,
      });
      setProgress(5);
      await uploadHomeFile(draft.storagePath, video, setProgress);
      if (thumb) {
        assertHomeThumb(thumb);
        await uploadHomeFile(draft.thumbnailPath, thumb);
      }
      if (caption) {
        assertHomeCaption(caption);
        await uploadHomeFile(draft.captionPath, caption);
      }
      await submit.mutateAsync({
        videoId: draft.videoId,
        title,
        description,
        subject,
        topic: topic.trim() || null,
        level,
        curriculum: null,
        language: "English",
        durationSeconds,
        publishAsSchool: asSchool,
        rightsConfirmed: rights,
        noIdentifiableStudents: noStudents,
        hasCaption: Boolean(caption),
        hasThumbnail: Boolean(thumb),
      });
      toast.success(
        "Submitted for review. It is not public until a platform operator approves it.",
      );
      setProgress(0);
      form.reset();
      setRights(false);
      setNoStudents(false);
    } catch (error) {
      toast.error(authErrorMessage(error));
      setProgress(0);
    }
  }

  return (
    <>
      <PageHeader
        title="Home studio"
        subtitle="Educational short videos. Clips stay private until a platform operator approves them."
      />
      <Panel title="Upload" description="MP4, WebM or QuickTime · 5 seconds–3 minutes · 80 MB max">
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="description">Educational description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Subject</Label>
              <Select
                value={subject}
                onValueChange={(value) => setSubject(value as typeof subject)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOME_SUBJECTS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {homeSubjectLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Level</Label>
              <Select value={level} onValueChange={(value) => setLevel(value as typeof level)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOME_LEVELS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {homeSubjectLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="topic">Topic (optional)</Label>
            <Input id="topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="video">Video file</Label>
            <Input
              id="video"
              name="video"
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              required
            />
          </div>
          <div>
            <Label htmlFor="thumb">Thumbnail (optional)</Label>
            <Input id="thumb" name="thumb" type="file" accept="image/*" />
          </div>
          <div>
            <Label htmlFor="caption">Captions .vtt (optional)</Label>
            <Input id="caption" name="caption" type="file" accept=".vtt,text/vtt" />
          </div>
          {role.data === "admin" || role.data === "institution" ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={asSchool}
                onCheckedChange={(value) => setAsSchool(value === true)}
              />
              Publish on my school channel
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={rights} onCheckedChange={(value) => setRights(value === true)} />I
            have the right to publish this educational clip
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={noStudents}
              onCheckedChange={(value) => setNoStudents(value === true)}
            />
            This clip does not show identifiable student footage
          </label>
          {progress > 0 ? <Progress value={progress} /> : null}
          <Button type="submit" disabled={create.isPending || submit.isPending}>
            Submit for review
          </Button>
        </form>
      </Panel>

      <Panel title="Your videos" className="mt-6">
        {mine.isLoading ? (
          <ListSkeleton rows={3} />
        ) : (mine.data ?? []).length === 0 ? (
          <EmptyState
            icon={Clapperboard}
            title="No uploads yet"
            hint="Submitted clips stay private until approved."
          />
        ) : (
          <ul className="space-y-3">
            {(mine.data ?? []).map((video) => (
              <li
                key={video.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{video.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {video.status.replaceAll("_", " ")}
                  </p>
                </div>
                {video.status === "published" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      unpublish.mutate(video.id, {
                        onSuccess: () => toast.success("Removed from Home"),
                        onError: (error) => toast.error(authErrorMessage(error)),
                      })
                    }
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
