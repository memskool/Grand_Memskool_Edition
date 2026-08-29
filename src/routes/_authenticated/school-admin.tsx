import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Building2,
  CalendarPlus,
  Copy,
  Loader2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useSession, useRole } from "@/hooks/useAuth";
import { canManageSchool } from "@/lib/nav";
import { useMySchool, useSchoolMembers, useSetMemberStatus } from "@/lib/school-membership";
import {
  AcademicStructurePanel,
  CurriculumPanel,
  EnrolmentPanel,
} from "@/components/app/AcademicAdminPanel";
import { FamilyLinkPanel } from "@/components/app/FamilyLinkPanel";
import { useCreateSlotSafe } from "@/features/academic/academic-data";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import {
  useCreateSchool,
  useAllApplications,
  useUpdateApplicationStatus,
  useAllClasses,
  useCreateClass,
  useDeleteTimetableSlot,
  useWeeklyTimetable,
  useMeetings,
  useCreateMeeting,
  useDeleteMeeting,
  useStaffDirectory,
  SCHOOL_CATEGORIES,
  MEETING_KINDS,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/discovery-data";
import { useSubjects } from "@/lib/content-data";
import { WeeklyTimetable } from "@/components/app/WeeklyTimetable";
import { ApplicationsTracker } from "@/components/app/ApplicationsTracker";
import { AnnouncementComposer } from "@/components/app/AnnouncementComposer";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAYS, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/school-admin")({
  head: () => ({
    meta: [
      { title: "School Administration — Memskool" },
      {
        name: "description",
        content:
          "Register your digital school, manage classes, timetables, teacher profiles, admissions and PTA meetings.",
      },
      { property: "og:title", content: "School Administration — Memskool" },
      {
        property: "og:description",
        content:
          "The Memskool control room for school admins: classes, timetables, admissions and meetings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SchoolAdminPage,
});

function SchoolAdminPage() {
  const { user } = useSession();
  const role = useRole(user);
  const school = useMySchool(user?.id);
  const isAdmin = canManageSchool(role.data ?? undefined);

  if (role.isLoading) {
    return (
      <>
        <PageHeader title="School Administration" />
        <ListSkeleton rows={4} />
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="School Administration" />
        <EmptyState
          icon={ShieldAlert}
          title="Admins only"
          hint="This control room is available to school administrators."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="School Administration"
        subtitle="Run your school from one place — one online school per institution account."
      />
      <Tabs defaultValue="school" className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="school">School</TabsTrigger>
          <TabsTrigger value="academic">Academic year</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum</TabsTrigger>
          <TabsTrigger value="enrolment">Classes & enrolment</TabsTrigger>
          <TabsTrigger value="families">Families</TabsTrigger>
          <TabsTrigger value="classes">Timetable</TabsTrigger>
          <TabsTrigger value="staff">Teachers</TabsTrigger>
          <TabsTrigger value="admissions">Admissions</TabsTrigger>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="announcements">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="school">
          <SchoolSection userId={user?.id} />
        </TabsContent>
        <TabsContent value="academic">
          <AcademicStructurePanel
            schoolId={school.data?.id}
            currentYearId={
              school.data && "current_academic_year_id" in school.data
                ? ((school.data as { current_academic_year_id?: string | null })
                    .current_academic_year_id ?? null)
                : null
            }
            periodLabel={
              school.data && "academic_period_label" in school.data
                ? ((school.data as { academic_period_label?: string | null })
                    .academic_period_label ?? null)
                : null
            }
          />
        </TabsContent>
        <TabsContent value="curriculum">
          <CurriculumPanel schoolId={school.data?.id} userId={user?.id ?? undefined} />
        </TabsContent>
        <TabsContent value="enrolment">
          <EnrolmentPanel schoolId={school.data?.id} />
        </TabsContent>
        <TabsContent value="families">
          <FamilyLinkPanel schoolId={school.data?.id} />
        </TabsContent>
        <TabsContent value="classes">
          <ClassesSection userId={user?.id} />
        </TabsContent>
        <TabsContent value="staff">
          <StaffSection />
        </TabsContent>
        <TabsContent value="admissions">
          <AdmissionsSection schoolId={school.data?.id} />
        </TabsContent>
        <TabsContent value="meetings">
          <MeetingsSection userId={user?.id} />
        </TabsContent>
        <TabsContent value="announcements">
          <AnnouncementsSection />
        </TabsContent>
      </Tabs>
    </>
  );
}

/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */

type SchoolProfileFields = {
  id?: string;
  name?: string;
  code?: string;
  category?: string;
  city?: string | null;
  country?: string | null;
  website?: string | null;
  description?: string | null;
  fees_min?: number | null;
  fees_max?: number | null;
  badges?: string[];
  is_international?: boolean;
  admissions_open?: boolean;
};

function SchoolSection({ userId }: { userId?: string | undefined }) {
  const mySchool = useMySchool(userId);
  const save = useCreateSchool(userId);
  const school = (mySchool.data ?? null) as SchoolProfileFields | null;
  const hasSchool = Boolean(school?.id);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("secondary");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("Uganda");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [feesMin, setFeesMin] = useState("");
  const [feesMax, setFeesMax] = useState("");
  const [badges, setBadges] = useState("");
  const [international, setInternational] = useState(false);
  const [admissionsOpen, setAdmissionsOpen] = useState(true);

  useEffect(() => {
    if (!school?.id) return;
    setName(school.name ?? "");
    setCategory(school.category || "secondary");
    setCity(school.city ?? "");
    setCountry(school.country || "Uganda");
    setWebsite(school.website ?? "");
    setDescription(school.description ?? "");
    setFeesMin(school.fees_min != null ? String(school.fees_min) : "");
    setFeesMax(school.fees_max != null ? String(school.fees_max) : "");
    setBadges(Array.isArray(school.badges) ? school.badges.join(", ") : "");
    setInternational(Boolean(school.is_international));
    setAdmissionsOpen(school.admissions_open !== false);
    // Only hydrate when the managed school changes so in-progress edits are not overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- school.id is the identity we care about
  }, [school?.id]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("School name is required");
      return;
    }
    try {
      await save.mutateAsync({
        name: name.trim(),
        category,
        city: city.trim() || null,
        country: country.trim() || "Uganda",
        website: website.trim() || null,
        description: description.trim() || null,
        fees_min: feesMin ? Number(feesMin) : null,
        fees_max: feesMax ? Number(feesMax) : null,
        badges: badges
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean),
        is_international: international,
        admissions_open: admissionsOpen,
      });
      toast.success(
        hasSchool
          ? "School profile updated"
          : "School created. Use the tabs above to manage classes, admissions and staff.",
      );
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  if (mySchool.isLoading) {
    return <ListSkeleton rows={4} />;
  }

  const code = school?.code ?? "";

  return (
    <div className="space-y-6">
      <Panel
        title={hasSchool ? school?.name || "Your school" : "Create your online school"}
        description={
          hasSchool
            ? "This account runs one school. Students find it in Dream School; you manage it here."
            : "Each institution account can create one school. After that you receive applications and run classes from this workspace."
        }
      >
        {hasSchool ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">School ID</p>
              <p className="font-display text-xl font-bold tracking-tight">{code || "—"}</p>
              <p className="text-xs text-muted-foreground">
                Share this with teachers and students so they can join.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={admissionsOpen ? "default" : "outline"}>
                {admissionsOpen ? "Admissions open" : "Admissions closed"}
              </Badge>
              {code ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    void navigator.clipboard.writeText(code);
                    toast.success("School ID copied");
                  }}
                >
                  <Copy className="size-4" /> Copy ID
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-name">School name</Label>
            <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHOOL_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-city">City</Label>
            <Input id="s-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-country">Country</Label>
            <Input id="s-country" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-web">Website</Label>
            <Input
              id="s-web"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-badges">Badges (comma separated)</Label>
            <Input
              id="s-badges"
              value={badges}
              onChange={(e) => setBadges(e.target.value)}
              placeholder="Boarding, STEM"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-fmin">Fees from</Label>
            <Input
              id="s-fmin"
              type="number"
              value={feesMin}
              onChange={(e) => setFeesMin(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-fmax">Fees to</Label>
            <Input
              id="s-fmax"
              type="number"
              value={feesMax}
              onChange={(e) => setFeesMax(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="s-intl" checked={international} onCheckedChange={setInternational} />
            <Label htmlFor="s-intl">International school</Label>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <Switch id="s-adm" checked={admissionsOpen} onCheckedChange={setAdmissionsOpen} />
            <Label htmlFor="s-adm">Admissions open</Label>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="s-desc">Description</Label>
            <Textarea
              id="s-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={() => void submit()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Building2 className="size-4" />
          )}
          {hasSchool ? "Save changes" : "Create school"}
        </Button>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function ClassesSection({ userId }: { userId?: string | undefined }) {
  const classes = useAllClasses(true);
  const subjects = useSubjects();
  const staff = useStaffDirectory(true);
  const timetable = useWeeklyTimetable(userId);
  const createClass = useCreateClass();
  const createSlot = useCreateSlotSafe();
  const deleteSlot = useDeleteTimetableSlot();

  const [className, setClassName] = useState("");
  const [subjectId, setSubjectId] = useState("none");
  const [teacherId, setTeacherId] = useState("none");
  const [room, setRoom] = useState("");

  const [slotClass, setSlotClass] = useState("");
  const [day, setDay] = useState("1");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("09:00");

  const teachers = (staff.data ?? []).filter((r) => r.role === "teacher");

  const addClass = async () => {
    if (!className.trim()) {
      toast.error("Class level name is required");
      return;
    }
    try {
      await createClass.mutateAsync({
        name: className.trim(),
        subject_id: subjectId === "none" ? null : subjectId,
        teacher_id: teacherId === "none" ? null : teacherId,
        room: room.trim() || null,
      });
      setClassName("");
      toast.success("Class level created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create class");
    }
  };

  const addSlot = async () => {
    if (!slotClass) {
      toast.error("Pick a class first");
      return;
    }
    try {
      await createSlot.mutateAsync({
        class_id: slotClass,
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
        subject_id: null,
        teacher_id: null,
        academic_period_id: null,
        room: null,
      });
      toast.success("Timetable updated for teachers and students");
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Class levels" description="Create the classes your school runs">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Class name</Label>
            <Input
              id="c-name"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="Form One A"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(subjects.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {teachers.map((t) => (
                  <SelectItem key={t.user_id} value={t.user_id}>
                    {t.profile?.full_name || "Teacher"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-room">Room</Label>
            <Input id="c-room" value={room} onChange={(e) => setRoom(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={addClass} disabled={createClass.isPending}>
              <Plus className="size-4" /> Add class
            </Button>
          </div>
        </div>
      </Panel>

      <Panel
        title="Schedule a lesson slot"
        description="Changes sync instantly to every affected timetable"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={slotClass} onValueChange={setSlotClass}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {(classes.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Day</Label>
            <Select value={day} onValueChange={setDay}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map((d, i) => (
                  <SelectItem key={d} value={String(i)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-start">Start</Label>
            <Input
              id="t-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-end">End</Label>
            <Input id="t-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button className="w-full" onClick={addSlot} disabled={createSlot.isPending}>
              <CalendarPlus className="size-4" /> Add slot
            </Button>
          </div>
        </div>

        <div className="mt-5">
          <WeeklyTimetable
            slots={timetable.data ?? []}
            loading={timetable.isLoading}
            onRemove={(id) => deleteSlot.mutate(id)}
          />
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function StaffSection() {
  const staff = useStaffDirectory(true);
  const rows = (staff.data ?? []).filter((r) => r.role === "teacher" || r.role === "admin");

  return (
    <Panel title="Teacher profiles" description="Staff accounts registered on your Memskool school">
      {staff.isLoading ? (
        <ListSkeleton rows={3} />
      ) : rows.length ? (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={`${r.user_id}-${r.role}`}
              className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3"
            >
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.profile?.full_name || "Unnamed"}</p>
                <p className="truncate text-xs text-muted-foreground">{r.profile?.email ?? "—"}</p>
              </div>
              <Badge variant="outline" className="capitalize">
                {r.role}
              </Badge>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Users}
          title="No staff accounts yet"
          hint="Teachers appear here once they sign up."
        />
      )}
    </Panel>
  );
}

/* ---------------------------------------------------------------- */

function AdmissionsSection({ schoolId }: { schoolId?: string | undefined }) {
  const applications = useAllApplications(schoolId);
  const update = useUpdateApplicationStatus();
  const members = useSchoolMembers(schoolId);
  const setStatus = useSetMemberStatus(schoolId);
  const [notesFor, setNotesFor] = useState<string | null>(null);
  const [pendingStatus, setPendingStatus] = useState<ApplicationStatus | null>(null);
  const [draftNotes, setDraftNotes] = useState("");

  const pendingMembers = (members.data ?? []).filter((m) => m.status === "pending");

  if (!schoolId) {
    return (
      <EmptyState
        icon={Building2}
        title="Open your school first"
        hint="Create your school on the School tab, then return here to review applications and join requests."
      />
    );
  }

  const review = async (appId: string, status: ApplicationStatus) => {
    try {
      await update.mutateAsync({
        id: appId,
        status,
        ...(draftNotes.trim() ? { notes: draftNotes.trim() } : {}),
      });
      setNotesFor(null);
      setPendingStatus(null);
      setDraftNotes("");
      toast.success(
        status === "approved"
          ? "Application approved — student enrolled and notified."
          : "Application updated — applicant notified.",
      );
    } catch (err) {
      toast.error(authErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Join requests" description="Teachers and staff waiting for your approval">
        {members.isLoading ? (
          <ListSkeleton rows={2} />
        ) : pendingMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No pending join requests"
            hint="When teachers sign up with your School ID, they appear here for approval."
          />
        ) : (
          <ul className="space-y-2">
            {pendingMembers.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.user?.full_name || m.user?.email || "New member"}
                  </p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {m.role}
                    {m.student_code ? ` · ${m.student_code}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate(
                        { id: m.id, status: "approved" },
                        {
                          onSuccess: () => toast.success("Member approved"),
                          onError: (err) => toast.error(authErrorMessage(err)),
                        },
                      )
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    disabled={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate(
                        { id: m.id, status: "rejected" },
                        {
                          onSuccess: () => toast.success("Request declined"),
                          onError: (err) => toast.error(authErrorMessage(err)),
                        },
                      )
                    }
                  >
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Admission applications"
        description="Dream School applications to your institution"
      >
        <ApplicationsTracker
          variant="admin"
          applications={applications.data ?? []}
          loading={applications.isLoading}
          action={(app) => (
            <div className="flex shrink-0 flex-col items-end gap-2">
              <Select
                value={app.status}
                onValueChange={(status) => {
                  const next = status as ApplicationStatus;
                  if (next === "rejected" || next === "approved") {
                    setNotesFor(app.id);
                    setPendingStatus(next);
                    setDraftNotes(app.review_notes ?? "");
                  } else {
                    void review(app.id, next);
                  }
                }}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLICATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {notesFor === app.id ? (
                <div className="w-56 space-y-2 rounded-xl border border-border bg-background p-3">
                  <Textarea
                    rows={2}
                    placeholder="Optional note to the applicant"
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setNotesFor(null);
                        setPendingStatus(null);
                        setDraftNotes("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      disabled={update.isPending || !pendingStatus}
                      onClick={() => {
                        if (pendingStatus) void review(app.id, pendingStatus);
                      }}
                    >
                      Confirm
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        />
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function MeetingsSection({ userId }: { userId?: string | undefined }) {
  const meetings = useMeetings();
  const classes = useAllClasses(true);
  const create = useCreateMeeting(userId);
  const remove = useDeleteMeeting();

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("pta");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [classId, setClassId] = useState("all");
  const [description, setDescription] = useState("");

  const submit = async () => {
    if (!title.trim() || !when) {
      toast.error("Title and date/time are required");
      return;
    }
    try {
      await create.mutateAsync({
        title: title.trim(),
        kind,
        description: description.trim() || null,
        scheduled_at: new Date(when).toISOString(),
        duration_minutes: Number(duration) || 60,
        location: location.trim() || null,
        meeting_url: url.trim() || null,
        class_id: classId === "all" ? null : classId,
      });
      setTitle("");
      setDescription("");
      toast.success("Meeting broadcast to the school");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule meeting");
    }
  };

  return (
    <div className="space-y-6">
      <Panel title="Schedule a meeting" description="PTA, AGM and parent–teacher sessions">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-title">Title</Label>
            <Input id="m-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MEETING_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-when">Date & time</Label>
            <Input
              id="m-when"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-dur">Duration (min)</Label>
            <Input
              id="m-dur"
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-loc">Location</Label>
            <Input id="m-loc" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="m-url">Meeting link</Label>
            <Input
              id="m-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Audience</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Whole school</SelectItem>
                {(classes.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
            <Label htmlFor="m-desc">Agenda</Label>
            <Textarea
              id="m-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <Button className="mt-4" onClick={submit} disabled={create.isPending}>
          <CalendarPlus className="size-4" /> Schedule & broadcast
        </Button>
      </Panel>

      <Panel title="Upcoming meetings" description="Everything on the school calendar">
        {meetings.isLoading ? (
          <ListSkeleton rows={2} />
        ) : meetings.data?.length ? (
          <ul className="space-y-2">
            {meetings.data.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl bg-secondary/50 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(m.scheduled_at)} · {m.class?.name ?? "Whole school"}
                    {m.location ? ` · ${m.location}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="uppercase">
                  {m.kind}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete meeting"
                  onClick={() => remove.mutate(m.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={CalendarPlus} title="No meetings scheduled" />
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- */

function AnnouncementsSection() {
  const classes = useAllClasses(true);
  return (
    <AnnouncementComposer
      canBroadcastSchoolWide
      classes={(classes.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
