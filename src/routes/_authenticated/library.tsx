import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Library, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, EmptyState, ListSkeleton } from "@/components/app/primitives";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Library — Memskool" },
      {
        name: "description",
        content: "Browse subjects and learning resources available across your school on Memskool.",
      },
      { property: "og:title", content: "Library — Memskool" },
      { property: "og:description", content: "Subjects and learning resources for every class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LibraryPage,
});

function useSubjects() {
  return useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("id, name, code")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function LibraryPage() {
  const subjects = useSubjects();

  return (
    <>
      <PageHeader title="Library" subtitle="Subjects and resources across your school." />
      <Panel title="Subjects" description="Everything your school currently offers">
        {subjects.isLoading ? (
          <ListSkeleton />
        ) : subjects.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.data.map((s) => (
              <li key={s.id} className="rounded-xl bg-secondary/50 p-4">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <BookOpen className="size-4" />
                </span>
                <p className="mt-3 text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.code}</p>
                {s.description ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Library}
            title="No subjects published yet"
            hint="An administrator can add subjects to fill out the library."
          />
        )}
      </Panel>
    </>
  );
}
