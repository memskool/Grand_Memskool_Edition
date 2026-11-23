import { useMemo, useState } from "react";
import { Download, Printer, Upload } from "lucide-react";
import { toast } from "sonner";
import { ChipGroup, Panel } from "@/components/app/primitives";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { authErrorMessage } from "@/lib/errors/auth-errors";
import { BOM, parseImportText, toCsv, type ImportRole } from "@/features/academic/report-policy";
import { useBulkImport, type ImportResultRow } from "@/features/academic/reports-data";

const EXAMPLES: Record<ImportRole, string> = {
  student: "Name, Email, Class\nNakato Sarah, sarah@example.com, S1 East\nOkello John, , S1 East",
  teacher: "Name, Email\nMs Achieng Grace, achieng@example.com",
  parent: "Name, Email, Child\nMrs Nambi Ruth, nambi@example.com, sarah@example.com",
};

const HELP: Record<ImportRole, string> = {
  student:
    "One student per line: name, email (optional), class. Students without email get a school sign-in and a temporary password to print.",
  teacher: "One teacher per line: name, email. They are approved straight away.",
  parent:
    "One parent per line: name, email, and the child's email or school sign-in. The child must already be in your school.",
};

/**
 * School managers add a whole roll at once (Phase 5). Accounts are created on the
 * server; this panel only parses, previews, sends in batches and shows the outcome.
 */
export function BulkImportPanel() {
  const [role, setRole] = useState<ImportRole>("student");
  const [text, setText] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportResultRow[] | null>(null);
  const importer = useBulkImport();
  const parsed = useMemo(() => (text.trim() ? parseImportText(text, role) : null), [text, role]);
  const slips = (results ?? []).filter((r) => r.temp_password);

  const run = () => {
    if (!parsed?.rows.length) return;
    setResults(null);
    setProgress({ done: 0, total: parsed.rows.length });
    importer.mutate(
      {
        role,
        rows: parsed.rows,
        onProgress: (done, total) => setProgress({ done, total }),
      },
      {
        onSuccess: (rows) => {
          setResults(rows);
          const ok = rows.filter((r) => r.status === "created" || r.status === "added").length;
          toast.success(`${ok} of ${rows.length} imported.`);
        },
        onError: (e) => toast.error(authErrorMessage(e)),
        onSettled: () => setProgress(null),
      },
    );
  };

  const downloadResults = () => {
    if (!results) return;
    const csv = toCsv([
      ["Line", "Name", "Result", "Sign-in", "Temporary password", "Class", "Details"],
      ...results.map((r) => [
        r.line,
        r.full_name,
        r.status,
        r.sign_in ?? "",
        r.temp_password ?? "",
        r.enrolled_in ?? "",
        r.message,
      ]),
    ]);
    const url = URL.createObjectURL(new Blob([`${BOM}${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `memskool_import_${role}s.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      title="Bulk import"
      description="Add a whole class, staff room or parent list at once. Paste from a spreadsheet or a CSV file."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ChipGroup
            label="Who are you importing?"
            value={role}
            onChange={(v) => {
              setRole(v);
              setResults(null);
            }}
            options={[
              { value: "student", label: "Students" },
              { value: "teacher", label: "Teachers" },
              { value: "parent", label: "Parents" },
            ]}
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-secondary">
            <Upload className="size-4" /> Open CSV
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 1_000_000) {
                  toast.error("That file is larger than 1 MB. Split it into smaller lists.");
                  return;
                }
                setText(await file.text());
              }}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">{HELP[role]}</p>
        <Textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLES[role]}
          className="font-mono text-xs"
        />
        {parsed ? (
          <div className="text-xs">
            <p className="font-medium">
              {parsed.rows.length} ready to import
              {parsed.errors.length ? ` · ${parsed.errors.length} line(s) need fixing` : ""}
            </p>
            {parsed.errors.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-destructive">
                {parsed.errors.slice(0, 8).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {parsed.errors.length > 8 ? <li>…and {parsed.errors.length - 8} more</li> : null}
              </ul>
            ) : null}
          </div>
        ) : null}
        <Button
          className="rounded-full"
          disabled={!parsed?.rows.length || importer.isPending}
          onClick={run}
        >
          {progress
            ? `Importing ${progress.done} / ${progress.total}…`
            : `Import ${parsed?.rows.length ?? 0} ${role}${parsed?.rows.length === 1 ? "" : "s"}`}
        </Button>

        {results ? (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2" data-print-hide>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full"
                onClick={downloadResults}
              >
                <Download className="mr-1.5 size-4" /> Download results
              </Button>
              {slips.length ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-1.5 size-4" /> Print sign-in slips
                </Button>
              ) : null}
            </div>
            {slips.length ? (
              <p className="text-xs font-medium text-destructive" data-print-hide>
                Temporary passwords are shown only now. Download or print them before leaving this
                page.
              </p>
            ) : null}
            <ul className="max-h-80 space-y-1.5 overflow-y-auto print:max-h-none print:overflow-visible">
              {results.map((r) => (
                <li
                  key={`${r.line}-${r.full_name}`}
                  className="rounded-xl bg-secondary/50 px-3 py-2 text-sm print:break-inside-avoid print:border print:border-dashed print:bg-transparent"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.full_name}</span>
                    <Badge
                      variant={
                        r.status === "skipped"
                          ? "destructive"
                          : r.status === "already"
                            ? "outline"
                            : "default"
                      }
                      className="text-[10px]"
                      data-print-hide
                    >
                      {r.status}
                    </Badge>
                    {r.enrolled_in ? (
                      <span className="text-xs text-muted-foreground">{r.enrolled_in}</span>
                    ) : null}
                  </div>
                  {r.sign_in ? (
                    <p className="mt-1 font-mono text-xs">
                      Sign in at memskool.com with <strong>{r.sign_in}</strong> · password{" "}
                      <strong>{r.temp_password}</strong>
                    </p>
                  ) : null}
                  <p className="text-xs text-muted-foreground" data-print-hide>
                    {r.message}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
