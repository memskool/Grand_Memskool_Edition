/**
 * Pure rules for the gradebook, report cards and bulk import (Phase 5).
 * No Firebase imports, so the maths and parsing are unit-tested in isolation.
 */

/** Default grading scale (percent floors). Schools can be given their own scale later. */
export const DEFAULT_GRADE_SCALE: ReadonlyArray<{ min: number; grade: string; label: string }> = [
  { min: 80, grade: "A", label: "Excellent" },
  { min: 70, grade: "B", label: "Very good" },
  { min: 60, grade: "C", label: "Good" },
  { min: 50, grade: "D", label: "Fair" },
  { min: 0, grade: "E", label: "Needs support" },
];

export function percentOf(score: number | null | undefined, max: number | null | undefined) {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  if (!max || !Number.isFinite(max) || max <= 0) return null;
  return Math.max(0, Math.min(100, (score / max) * 100));
}

export function averageOf(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function roundPct(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

export function letterGrade(pct: number | null): { grade: string; label: string } | null {
  if (pct === null) return null;
  const row = DEFAULT_GRADE_SCALE.find((s) => pct >= s.min) ?? DEFAULT_GRADE_SCALE.at(-1)!;
  return { grade: row.grade, label: row.label };
}

/** A school's coursework / test split (percent, summing to 100). null = plain average. */
export type GradingWeights = { coursework: number; tests: number } | null;

export function normaliseWeights(raw: unknown): GradingWeights {
  if (!raw || typeof raw !== "object") return null;
  const c = Number((raw as { coursework?: unknown }).coursework);
  const t = Number((raw as { tests?: unknown }).tests);
  if (!Number.isFinite(c) || !Number.isFinite(t) || c < 0 || t < 0 || c + t !== 100) return null;
  return { coursework: c, tests: t };
}

/**
 * Overall percent for one subject. With weights, coursework and tests are blended by the
 * school's split (a missing side falls back to the other). Without weights, every marked
 * item counts equally — the behaviour schools had before choosing a split.
 */
export function weightedOverall(input: {
  courseworkPcts: Array<number | null>;
  testPcts: Array<number | null>;
  weights: GradingWeights;
}): number | null {
  if (!input.weights) return averageOf([...input.courseworkPcts, ...input.testPcts]);
  const cw = averageOf(input.courseworkPcts);
  const ts = averageOf(input.testPcts);
  if (cw === null) return ts;
  if (ts === null) return cw;
  return (cw * input.weights.coursework + ts * input.weights.tests) / 100;
}

export type PeriodWindow = { starts_on: string; ends_on: string } | null;

/** True when `iso` falls inside the term (inclusive of the whole end day); no term = all time. */
export function inPeriod(iso: string | null | undefined, period: PeriodWindow): boolean {
  if (!period) return true;
  if (!iso) return false;
  const day = iso.slice(0, 10);
  return day >= period.starts_on.slice(0, 10) && day <= period.ends_on.slice(0, 10);
}

/** Highest percentage among a student's attempts (null when none were scored). */
export function bestPercent(
  attempts: Array<{ score: number | null; max: number | null }>,
): number | null {
  let best: number | null = null;
  for (const a of attempts) {
    const pct = percentOf(a.score, a.max);
    if (pct !== null && (best === null || pct > best)) best = pct;
  }
  return best;
}

/**
 * CSV for spreadsheet export. Cells that start with = + - @ are prefixed with ' so a name
 * like "=HYPERLINK(...)" cannot run as a formula when a teacher opens the file.
 */
export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const cell = (value: string | number | null | undefined) => {
    let text = value === null || value === undefined ? "" : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Bulk import parsing                                                 */
/* ------------------------------------------------------------------ */

export type ImportRole = "student" | "teacher" | "parent";

export type ImportRow = {
  line: number;
  full_name: string;
  email: string | null;
  class_name: string | null;
  /** Parents: the child's email or school sign-in ID. */
  child: string | null;
};

/** Byte-order mark: Excel needs it to open UTF-8 CSV correctly; strip it on import. */
export const BOM = String.fromCharCode(0xfeff);
const BOM_RE = new RegExp("^" + BOM);

export const MAX_IMPORT_ROWS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t" || ch === ";") {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const HEADER_ALIASES: Record<string, keyof Omit<ImportRow, "line">> = {
  name: "full_name",
  "full name": "full_name",
  full_name: "full_name",
  "student name": "full_name",
  email: "email",
  "e-mail": "email",
  "email address": "email",
  class: "class_name",
  "class name": "class_name",
  stream: "class_name",
  child: "child",
  "child email": "child",
  "child id": "child",
  "child sign-in": "child",
};

/**
 * Parses a pasted list or CSV (comma, tab or semicolon). A header row is optional:
 * without one, columns are name, email, class (students/teachers) or name, email, child
 * (parents). Returns valid rows plus a readable error per rejected line.
 */
export function parseImportText(
  text: string,
  role: ImportRole,
): { rows: ImportRow[]; errors: string[] } {
  const lines = text
    .replace(BOM_RE, "")
    .split(/\r?\n/)
    .map((l, i) => ({ text: l.trim(), line: i + 1 }))
    .filter((l) => l.text.length > 0);
  const rows: ImportRow[] = [];
  const errors: string[] = [];
  if (!lines.length) return { rows, errors: ["Paste at least one person."] };

  let columns: Array<keyof Omit<ImportRow, "line"> | null> =
    role === "parent" ? ["full_name", "email", "child"] : ["full_name", "email", "class_name"];
  const firstCells = splitCsvLine(lines[0]!.text).map((c) => c.toLowerCase());
  if (firstCells.some((c) => c in HEADER_ALIASES)) {
    columns = firstCells.map((c) => HEADER_ALIASES[c] ?? null);
    lines.shift();
  }

  const seenEmails = new Set<string>();
  for (const { text: raw, line } of lines) {
    const cells = splitCsvLine(raw);
    const get = (key: keyof Omit<ImportRow, "line">) => {
      const idx = columns.indexOf(key);
      const value = idx >= 0 ? (cells[idx] ?? "").trim() : "";
      return value.length ? value : null;
    };
    const full_name = (get("full_name") ?? "").replace(/\s+/g, " ").slice(0, 120);
    const email = get("email")?.toLowerCase() ?? null;
    if (!full_name) {
      errors.push(`Line ${line}: a name is required.`);
      continue;
    }
    if (email && !EMAIL_RE.test(email)) {
      errors.push(`Line ${line}: "${email}" is not a valid email.`);
      continue;
    }
    if (!email && role !== "student") {
      errors.push(`Line ${line}: ${role}s need an email address to sign in.`);
      continue;
    }
    if (email) {
      if (seenEmails.has(email)) {
        errors.push(`Line ${line}: ${email} appears more than once.`);
        continue;
      }
      seenEmails.add(email);
    }
    const child = role === "parent" ? (get("child")?.toLowerCase() ?? null) : null;
    if (role === "parent" && !child) {
      errors.push(`Line ${line}: add the child's email or sign-in ID.`);
      continue;
    }
    rows.push({
      line,
      full_name,
      email,
      class_name: role === "parent" ? null : (get("class_name")?.slice(0, 80) ?? null),
      child,
    });
  }
  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push(`Import at most ${MAX_IMPORT_ROWS} people at a time.`);
    return { rows: rows.slice(0, MAX_IMPORT_ROWS), errors };
  }
  return { rows, errors };
}
