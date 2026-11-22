import {
  BOM,
  averageOf,
  bestPercent,
  inPeriod,
  letterGrade,
  parseImportText,
  percentOf,
  toCsv,
} from "./report-policy";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Percentages and grades
assert(percentOf(18, 20) === 90, "18/20 is 90%");
assert(percentOf(5, 0) === null, "no max means no percent");
assert(percentOf(null, 20) === null, "unmarked work has no percent");
assert(percentOf(25, 20) === 100, "percent is capped at 100");
assert(averageOf([80, null, 60]) === 70, "average ignores unmarked items");
assert(averageOf([]) === null, "no items means no average");
assert(letterGrade(85)?.grade === "A", "85 is an A");
assert(letterGrade(50)?.grade === "D", "50 is a D (floor inclusive)");
assert(letterGrade(12)?.grade === "E", "12 is an E");
assert(letterGrade(null) === null, "no score means no grade");
assert(
  bestPercent([
    { score: 4, max: 10 },
    { score: 9, max: 10 },
    { score: null, max: 10 },
  ]) === 90,
  "best attempt wins",
);

// Term windows
const term = { starts_on: "2026-02-01", ends_on: "2026-04-30" };
assert(inPeriod("2026-04-30T18:00:00.000Z", term), "end day is inclusive");
assert(!inPeriod("2026-05-01T00:00:00.000Z", term), "after the term is excluded");
assert(inPeriod("2020-01-01", null), "no term means all time");
assert(!inPeriod(null, term), "undated items are excluded from a term");

// CSV export is safe to open in a spreadsheet
const csv = toCsv([
  ["Name", "Mark"],
  ['Okello "Jr", A', 90],
  ["=HYPERLINK(evil)", null],
]);
assert(csv.includes('"Okello ""Jr"", A"'), "quotes and commas are escaped");
assert(csv.includes("'=HYPERLINK(evil)"), "formula injection is neutralised");

// Import parsing
const students = parseImportText(
  "Name,Email,Class\nNakato Sarah,sarah@example.com,S1 East\nOkello John,,S1 East\n,missing@x.com,S1\nBad Email,not-an-email,S2",
  "student",
);
assert(students.rows.length === 2, "two valid students");
assert(students.rows[1]!.email === null, "students may have no email");
assert(students.rows[0]!.class_name === "S1 East", "class column read from header");
assert(students.errors.length === 2, "missing name and bad email are reported");

const noHeader = parseImportText("Mukasa Peter\tpeter@example.com\tS2 West", "student");
assert(noHeader.rows[0]!.class_name === "S2 West", "tab-separated rows without a header");

const teachers = parseImportText("Ms Achieng,achieng@example.com\nMr NoEmail", "teacher");
assert(teachers.rows.length === 1 && teachers.errors.length === 1, "teachers need an email");

const parents = parseImportText(
  "name,email,child\nMrs Nambi,nambi@example.com,sarah@example.com\nMr Ssali,ssali@example.com,",
  "parent",
);
assert(parents.rows.length === 1 && parents.rows[0]!.child === "sarah@example.com", "parent child");
assert(parents.errors.length === 1, "parent without child is reported");

const dupes = parseImportText("A,a@example.com\nB,A@example.com", "student");
assert(dupes.rows.length === 1 && dupes.errors.length === 1, "duplicate emails are caught");

const excel = parseImportText(`${BOM}Name,Email,Class\nAmooti Ivan,,S3`, "student");
assert(
  excel.rows.length === 1 && excel.rows[0]!.class_name === "S3",
  "Excel BOM header is recognised",
);

console.log("report-policy unit checks passed");
