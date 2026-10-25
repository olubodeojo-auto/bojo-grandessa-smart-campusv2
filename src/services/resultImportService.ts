import * as XLSX from "xlsx";

import type { SchoolClass } from "../types/class";
import type { Result, ResultAssessmentType } from "../types/result";
import type { Student } from "../types/student";
import { calculateResult, computeTotal, gradeFromTotal, validateAssessmentMarks } from "../utils/resultCalculations";
import { parseScoreInput } from "../utils/scoreInput";

export type ResultImportMatchStatus = "matched" | "manual-review" | "unmatched";
export type ResultImportReportKind = "Midterm / Continuous Assessment" | "End-of-Term / Year Report Card" | "Unclear";
export type ResultImportScoreField = "continuousAssessment" | "maximumScore" | "examination" | "totalScore";
export type ResultImportReportDetailNumericField =
  | "classAverage"
  | "totalMarksObtained"
  | "totalMarksObtainable"
  | "studentPercentage"
  | "maximumAttendance"
  | "timesPresent"
  | "timesAbsent";
export type ResultWorkbookSheet = {
  name: string;
  academicYear: string;
  term: Result["term"] | null;
  terms: Result["term"][];
  studentBlockCount: number;
};
type StudentMatch = {
  status: ResultImportMatchStatus;
  matchedStudentId?: string;
  reviewReason?: string;
};

export type ResultImportItem = {
  assessmentType: ResultAssessmentType;
  calculationMode: "Manual" | "Automatic";
  reportKind: ResultImportReportKind;
  subjectName: string;
  subjectId?: string;
  className: string;
  classId?: string;
  teacherName: string;
  academicYear: string;
  term: Result["term"] | null;
  continuousAssessment: number | null;
  maximumScore: number | null;
  examination: number | null;
  totalScore: number | null;
  workbookTotal?: number | null;
  totalDerivedFromComponents?: boolean;
  scoreInputText?: Partial<Record<ResultImportScoreField, string>>;
  grade: string | null;
  remark: string | null;
  notices: string[];
  invalidMarks?: string[];
};

export type ResultImportPreviewEntry = {
  index: number;
  studentKey: string;
  studentName: string;
  admissionNumber: string;
  academicYear: string;
  term: Result["term"] | null;
  assessmentType: ResultAssessmentType;
  reportKind: ResultImportReportKind;
  className: string;
  teacherName: string;
  matchStatus: ResultImportMatchStatus;
  matchedStudentId?: string;
  selectedStudentId?: string;
  included?: boolean;
  reportDetails?: {
    age: string;
    classAverage: number | null;
    totalMarksObtained: number | null;
    totalMarksObtainable: number | null;
    studentPercentage: number | null;
    maximumAttendance: number | null;
    timesPresent: number | null;
    timesAbsent: number | null;
    termEnding: string;
    nextTermBegins: string;
    classTeacherComment: string;
    headTeacherComment: string;
  };
  reportDetailInputText?: Partial<Record<ResultImportReportDetailNumericField, string>>;
  warnings: string[];
  notices: string[];
  items: ResultImportItem[];
};

export function getImportEntryKey(entry: ResultImportPreviewEntry): string {
  return entry.studentKey;
}

export function getImportSubjectRowKey(entry: ResultImportPreviewEntry, itemIndex: number): string {
  return `${entry.studentKey}-subject-${itemIndex}`;
}

export function getNextUnresolvedImportSubjectIndex(
  items: ResultImportPreviewEntry["items"],
  currentIndex: number,
): number | null {
  const unresolvedIndices = items
    .map((item, index) => !item.subjectId ? index : -1)
    .filter((index) => index >= 0);
  if (unresolvedIndices.length === 0) return null;
  return unresolvedIndices.find((index) => index > currentIndex)
    ?? unresolvedIndices.find((index) => index !== currentIndex)
    ?? unresolvedIndices[0];
}

export type ImportReviewCursor = { entryKey: string; subjectRowKey?: string | null };

export function serializeImportReviewCursor(cursor: ImportReviewCursor): string {
  return JSON.stringify(cursor);
}

export function parseImportReviewCursor(value: string | null): ImportReviewCursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === "object" && "entryKey" in parsed
      && typeof parsed.entryKey === "string") {
      return {
        entryKey: parsed.entryKey,
        subjectRowKey: "subjectRowKey" in parsed && typeof parsed.subjectRowKey === "string"
          ? parsed.subjectRowKey
          : undefined,
      };
    }
  } catch {
    return { entryKey: value };
  }
  return null;
}

export function mergeSavedImportReviewDrafts(
  entries: ResultImportPreviewEntry[],
  savedEntries: ResultImportPreviewEntry[],
): ResultImportPreviewEntry[] {
  const savedByKey = new Map(savedEntries.map((entry) => [entry.studentKey, entry]));
  return entries.map((entry) => {
    const saved = savedByKey.get(entry.studentKey);
    return saved
      ? { ...entry, ...saved, index: entry.index, studentKey: entry.studentKey }
      : entry;
  });
}

export function searchImportStudents(students: Student[], search: string): Student[] {
  const normalizedQuery = search.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalizedQuery) return students;
  return students.filter((student) => {
    const fullName = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const admissionNumber = (student.admission_number ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    return fullName.includes(normalizedQuery) || admissionNumber.includes(normalizedQuery);
  });
}

export type NormalizedImportDate = { value: string | null; error?: string };

export function normalizeImportDate(value: string, label: string): NormalizedImportDate {
  const trimmed = value.trim();
  if (!trimmed) return { value: null };

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (date.getUTCFullYear() === Number(year)
      && date.getUTCMonth() === Number(month) - 1
      && date.getUTCDate() === Number(day)) {
      return { value: `${year}-${month}-${day}` };
    }
    return { value: null, error: `${label} must be a valid calendar date.` };
  }

  const normalized = trimmed
    .replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const dayMonthYear = normalized.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/i);
  const monthDayYear = normalized.match(/^([a-z]+)\s+(\d{1,2})\s+(\d{4})$/i);
  const match = dayMonthYear
    ? { day: Number(dayMonthYear[1]), monthName: dayMonthYear[2], year: Number(dayMonthYear[3]) }
    : monthDayYear
      ? { day: Number(monthDayYear[2]), monthName: monthDayYear[1], year: Number(monthDayYear[3]) }
      : null;
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ];
  const monthName = match?.monthName.toLowerCase();
  const monthIndex = monthName
    ? months.findIndex((month) => month === monthName || month.startsWith(monthName) && monthName.length === 3)
    : -1;
  if (match && monthIndex >= 0) {
    const date = new Date(Date.UTC(match.year, monthIndex, match.day));
    if (date.getUTCFullYear() === match.year
      && date.getUTCMonth() === monthIndex
      && date.getUTCDate() === match.day) {
      return {
        value: `${String(match.year).padStart(4, "0")}-${String(monthIndex + 1).padStart(2, "0")}-${String(match.day).padStart(2, "0")}`,
      };
    }
  }
  return { value: null, error: `${label} “${trimmed}” is not a valid date. Enter a date such as 14 September 2026.` };
}

export function getImportReportDateErrors(entry: ResultImportPreviewEntry): string[] {
  const details = entry.reportDetails;
  if (!details) return [];
  return [
    normalizeImportDate(details.termEnding, "Term ending").error,
    normalizeImportDate(details.nextTermBegins, "Next term begins").error,
  ].filter((error): error is string => Boolean(error));
}

export async function saveImportEntriesIndependently<Entry, Value>(
  entries: Entry[],
  saveEntry: (entry: Entry) => Promise<Value>,
): Promise<{
  saved: Array<{ entry: Entry; value: Value }>;
  failed: Array<{ entry: Entry; error: string }>;
}> {
  const saved: Array<{ entry: Entry; value: Value }> = [];
  const failed: Array<{ entry: Entry; error: string }> = [];
  for (const entry of entries) {
    try {
      saved.push({ entry, value: await saveEntry(entry) });
    } catch (error) {
      failed.push({
        entry,
        error: error instanceof Error ? error.message : "Unable to save this pupil's import.",
      });
    }
  }
  return { saved, failed };
}

export function updateImportEntryByKey(
  entries: ResultImportPreviewEntry[],
  studentKey: string,
  update: (entry: ResultImportPreviewEntry) => ResultImportPreviewEntry,
): ResultImportPreviewEntry[] {
  return entries.map((entry) => entry.studentKey === studentKey ? update(entry) : entry);
}

export function updateImportSubjectByKey(
  entries: ResultImportPreviewEntry[],
  studentKey: string,
  itemIndex: number,
  update: (item: ResultImportItem) => ResultImportItem,
): ResultImportPreviewEntry[] {
  return updateImportEntryByKey(entries, studentKey, (entry) => ({
    ...entry,
    items: entry.items.map((item, index) => index === itemIndex ? update(item) : item),
  }));
}

export type ExistingResultImportDecision =
  | { action: "create" }
  | { action: "skip" }
  | { action: "update"; result: Result };

export function resolveExistingResultImportDecision(
  matches: Result[],
  selectedResultId?: string,
): ExistingResultImportDecision {
  if (matches.length === 0) return { action: "create" };
  const selected = matches.find((result) => result.id === selectedResultId);
  return selected ? { action: "update", result: selected } : { action: "skip" };
}

export function resolveImportStudentAssignment(
  student: Pick<Student, "class_id"> | undefined,
  classes: SchoolClass[],
): { classId?: string; className: string; teacherId?: string; teacherName: string } {
  const schoolClass = student?.class_id
    ? classes.find((candidate) => candidate.id === student.class_id)
    : undefined;
  return {
    classId: schoolClass?.id,
    className: schoolClass?.class_name ?? "",
    teacherId: schoolClass?.class_teacher_id ?? undefined,
    teacherName: [schoolClass?.class_teacher?.first_name, schoolClass?.class_teacher?.last_name]
      .filter(Boolean)
      .join(" "),
  };
}

export function selectCreatedImportStudent(
  entry: ResultImportPreviewEntry,
  student: Student,
  classes: SchoolClass[],
): ResultImportPreviewEntry {
  const assignment = resolveImportStudentAssignment(student, classes);
  return {
    ...entry,
    selectedStudentId: student.id,
    matchedStudentId: student.id,
    matchStatus: "matched",
    className: assignment.className,
    teacherName: assignment.teacherName,
    items: entry.items.map((item) => ({
      ...item,
      classId: assignment.classId,
      className: assignment.className,
    })),
  };
}

export function isImportEntryReady(entry: ResultImportPreviewEntry): boolean {
  return Boolean(entry.included !== false && entry.selectedStudentId && entry.warnings.length === 0
    && entry.items.every((item) => Boolean(item.classId && item.subjectId))
    && getImportScoreWarnings(entry).length === 0);
}

export function getImportableResultEntries(
  entries: ResultImportPreviewEntry[],
): ResultImportPreviewEntry[] {
  return entries.filter(isImportEntryReady);
}

export function getUnresolvedIncludedResultEntries(
  entries: ResultImportPreviewEntry[],
): ResultImportPreviewEntry[] {
  return entries.filter((entry) => entry.included !== false && !isImportEntryReady(entry));
}

export function buildReviewedImportResultValues(params: {
  studentId: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherId?: string;
  teacherName: string;
  academicYear: string;
  term: Result["term"];
  item: ResultImportItem;
}): Omit<Result, "id" | "created_at" | "updated_at"> {
  const isMidterm = params.item.assessmentType === "CA";
  const calculated = isMidterm || params.item.calculationMode === "Manual"
    ? null
    : calculateResult(params.item.assessmentType, params.item.continuousAssessment, params.item.examination);
  return {
    student_id: params.studentId,
    class_id: params.classId,
    subject_id: params.subjectId,
    teacher_id: params.teacherId,
    class_name: params.className,
    subject_name: params.subjectName,
    teacher_name: params.teacherName,
    academic_year: params.academicYear,
    term: params.term,
    assessment_type: params.item.assessmentType,
    calculation_mode: params.item.calculationMode,
    continuous_assessment: params.item.continuousAssessment,
    maximum_score: isMidterm ? params.item.maximumScore : null,
    examination: isMidterm ? null : params.item.examination,
    total_score: isMidterm ? null : calculated ? calculated.total : params.item.totalScore,
    grade: isMidterm ? null : calculated ? calculated.grade : params.item.grade,
    remark: isMidterm ? null : calculated ? calculated.remark : params.item.remark,
    status: "Draft",
  };
}

type WorkbookRow = Record<string, unknown>;

type RowCandidate = {
  studentName: string;
  admissionNumber: string;
  academicYear: string;
  term: Result["term"] | null;
  className: string;
  teacherName: string;
  subjectName: string;
  reportKind: ResultImportReportKind;
  continuousAssessment: number | null;
  maximumScore: number | null;
  examination: number | null;
  totalScore: number | null;
  grade: string | null;
  remark: string | null;
  assessmentType: ResultAssessmentType;
  invalidMarks: string[];
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeMatchValue(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const subjectNameAliases = [
  ["mathematics", "maths", "math"],
  ["englishlanguage", "english"],
  ["computerict", "computerstudies", "ict"],
  ["historygeography", "historyandgeography"],
  ["homeeconomics", "homeeconomy"],
];

export function resolveSubjectMatch<T extends { subject_name: string }>(
  subjects: T[],
  workbookName: string,
): T | null {
  const normalized = normalizeMatchValue(workbookName);
  const exactMatches = subjects.filter((subject) => normalizeMatchValue(subject.subject_name) === normalized);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return null;

  const aliases = subjectNameAliases.find((group) => group.includes(normalized));
  if (!aliases) return null;
  const aliasMatches = subjects.filter((subject) => aliases.includes(normalizeMatchValue(subject.subject_name)));
  return aliasMatches.length === 1 ? aliasMatches[0] : null;
}

function detectReportKind(text: string, assessmentType: ResultAssessmentType): ResultImportReportKind {
  if (/mid[\s-]?term/i.test(text)) return "Midterm / Continuous Assessment";
  if (/end[\s-]?of[\s-]?term|year report|annual report|report card|terminal report/i.test(text)) {
    return "End-of-Term / Year Report Card";
  }
  if (assessmentType === "CA") return "Midterm / Continuous Assessment";
  if (assessmentType === "Examination" || assessmentType === "Combined") return "End-of-Term / Year Report Card";
  return "Unclear";
}

function firstMatchingValue(row: WorkbookRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function parseNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "" || /^(?:[-—–]|n\/a)$/i.test(String(value).trim())) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = String(value).replace(/[%,$\s]/g, "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function detectTerm(value: unknown): Result["term"] | null {
  const normalized = normalizeText(value).toLowerCase();

  if (/^(?:third|3rd)(?:\s+term)?$|^term\s*(?:3|three)$/.test(normalized)) {
    return "Third";
  }

  if (/^(?:second|2nd)(?:\s+term)?$|^term\s*(?:2|two)$/.test(normalized)) {
    return "Second";
  }

  if (/^(?:first|1st)(?:\s+term)?$|^term\s*(?:1|one)$/.test(normalized)) {
    return "First";
  }

  return null;
}

function detectTermFromText(value: string): Result["term"] | null {
  if (/\b(?:third|3rd)\s+term\b|\bterm\s*(?:3|three)\b/i.test(value)) return "Third";
  if (/\b(?:second|2nd)\s+term\b|\bterm\s*(?:2|two)\b/i.test(value)) return "Second";
  if (/\b(?:first|1st)\s+term\b|\bterm\s*(?:1|one)\b/i.test(value)) return "First";
  return null;
}

function detectAcademicYearFromText(value: string): string {
  const match = value.match(/20\d{2}\s*\/\s*20\d{2}/i);
  if (match) {
    return match[0].replace(/\s+/g, "");
  }

  const singleYear = value.match(/20\d{2}/i);
  return singleYear ? singleYear[0] : "";
}

function isMeaningfulStudentName(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return !/^NAME OF PUPIL\s*:??\s*$/i.test(trimmed)
    && !/^N\/?A$/i.test(trimmed)
    && !/^ENTER\s+NAME$/i.test(trimmed)
    && !/^TEMPLATE\s*$/i.test(trimmed);
}

function getSheetRows(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet["!ref"];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const firstRow = range.s.r;
  const lastRow = Math.min(range.e.r, firstRow + 1999);
  const firstColumn = range.s.c;
  const lastColumn = Math.min(range.e.c, firstColumn + 119);
  const rows: unknown[][] = [];

  for (let rowIndex = firstRow; rowIndex <= lastRow; rowIndex += 1) {
    const row: unknown[] = [];
    for (let columnIndex = firstColumn; columnIndex <= lastColumn; columnIndex += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      row.push(cell?.v ?? "");
    }
    rows.push(row);
  }

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => !normalizeText(cell))) rows.pop();
  return rows;
}

function detectSheetMetadata(rows: unknown[][]): {
  academicYear: string;
  term: Result["term"] | null;
  terms: Result["term"][];
  yearRank: number;
  termRank: number;
} {
  const combinedText = rows
    .map((row) => row.map((cell) => normalizeText(cell)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");

  const firstPeriodHeading = rows
    .map((row) => row.map((cell) => normalizeText(cell)).filter(Boolean).join(" "))
    .find((rowText) => /\bFOR\s*:/i.test(rowText) && /EXAMINATION/i.test(rowText));
  const metadataText = firstPeriodHeading || combinedText;
  const academicYear = detectAcademicYearFromText(metadataText);
  const term = detectTermFromText(metadataText);
  const detectedTerms = new Set<Result["term"]>();
  rows.forEach((row) => {
    const rowText = row.map((cell) => normalizeText(cell)).filter(Boolean).join(" ");
    for (const match of rowText.matchAll(/\b(first|1st|second|2nd|third|3rd)\s+term\b/gi)) {
      const rowTerm = detectTerm(match[0]);
      if (rowTerm) detectedTerms.add(rowTerm);
    }
  });
  if (term) detectedTerms.add(term);
  const orderedTerms: Result["term"][] = ["First", "Second", "Third"];
  const termRank = term === "Third" ? 3 : term === "Second" ? 2 : term === "First" ? 1 : 0;
  const yearRank = academicYear ? Number(academicYear.match(/20\d{2}/)?.[0] ?? "0") : 0;

  return {
    academicYear,
    term,
    terms: orderedTerms.filter((candidate) => detectedTerms.has(candidate)),
    yearRank,
    termRank,
  };
}

function findStudentBlockRanges(rows: unknown[][]): Array<{ row: number; col: number; endCol: number; endRow: number }> {
  const positions: Array<{ row: number; col: number }> = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const text = normalizeText(cell);
      if (/^NAME OF PUPIL\s*:/i.test(text)) {
        positions.push({ row: rowIndex, col: colIndex });
      }
    });
  });

  const ranges: Array<{ row: number; col: number; endCol: number; endRow: number }> = [];

  for (let i = 0; i < positions.length; i += 1) {
    const current = positions[i];
    const nextSameRow = positions
      .filter((candidate) => candidate.row === current.row && candidate.col > current.col)
      .sort((left, right) => left.col - right.col)[0];
    const endCol = nextSameRow?.col ?? current.col + 7;
    const endRow = Math.min(rows.length, current.row + 35);

    if (endCol <= current.col) {
      continue;
    }

    ranges.push({
      row: current.row,
      col: current.col,
      endCol,
      endRow,
    });
  }

  return ranges;
}

function readBlockStudentName(
  rows: unknown[][],
  block: { row: number; col: number; endCol: number; endRow: number },
): string {
  const blockHeader = rows[block.row]?.slice(block.col, block.endCol) ?? [];
  const inlineName = normalizeText(blockHeader[0]).replace(/^NAME OF PUPIL\s*:/i, "").trim();
  if (isMeaningfulStudentName(inlineName)) return inlineName;
  const classIndex = blockHeader.findIndex((cell) => /^CLASS\s*:/i.test(normalizeText(cell)));
  return blockHeader
    .slice(1, classIndex > 0 ? classIndex : undefined)
    .map(normalizeText)
    .find((value) => value && !/^(?:AGE|ADMISSION|REG(?:ISTRATION)?\s+NO\.?|NAME OF PUPIL)\s*:/i.test(value)
      && isMeaningfulStudentName(value)) ?? "";
}

function findBlockFieldValue(
  rows: unknown[][],
  block: { row: number; col: number; endCol: number; endRow: number },
  label: RegExp,
): string {
  for (let rowIndex = block.row; rowIndex < block.endRow; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let column = block.col; column < Math.min(block.endCol, row.length); column += 1) {
      const cell = normalizeText(row[column]);
      if (!label.test(cell)) continue;
      const inlineValue = cell.replace(label, "").replace(/^\s*[:=-]\s*/, "").trim();
      if (inlineValue) return inlineValue;
      for (let nextColumn = column + 1; nextColumn < Math.min(block.endCol, row.length); nextColumn += 1) {
        const next = normalizeText(row[nextColumn]);
        if (next) return next;
      }
    }
  }
  return "";
}

function readReportDetails(
  rows: unknown[][],
  block: { row: number; col: number; endCol: number; endRow: number },
): NonNullable<ResultImportPreviewEntry["reportDetails"]> {
  const numericValue = (label: RegExp): number | null => parseNumber(findBlockFieldValue(rows, block, label));
  const summaryValue = (label: RegExp): number | null => {
    for (let rowIndex = block.row; rowIndex < block.endRow; rowIndex += 1) {
      const row = rows[rowIndex] ?? [];
      for (let column = block.col; column < Math.min(block.endCol, row.length); column += 1) {
        if (label.test(normalizeText(row[column]))) {
          return parseNumber(row[block.col + 4]);
        }
      }
    }
    return null;
  };
  return {
    age: findBlockFieldValue(rows, block, /^\s*AGE\b/i),
    classAverage: numericValue(/^\s*CLASS\s+(?:AVERAGE|AVG)\b/i),
    totalMarksObtained: summaryValue(/^\s*TOTAL\s+MARKS?\s+OBTAINED\b/i),
    totalMarksObtainable: summaryValue(/^\s*TOTAL\s+MARKS?\s+OBTAINABLE\b/i),
    studentPercentage: summaryValue(/^\s*STUDENT\s+PERCENTAGE\b/i),
    maximumAttendance: numericValue(/^\s*(?:MAXIMUM|TOTAL)\s+ATTENDANCE\b/i),
    timesPresent: numericValue(/^\s*(?:TIMES\s+)?PRESENT\b/i),
    timesAbsent: numericValue(/^\s*(?:TIMES\s+)?ABSENT\b/i),
    termEnding: findBlockFieldValue(rows, block, /^\s*TERM\s+ENDING\b/i),
    nextTermBegins: findBlockFieldValue(rows, block, /^\s*NEXT\s+TERM\s+(?:BEGINS|STARTS)\b/i),
    classTeacherComment: findBlockFieldValue(rows, block, /^\s*(?:CLASS\s+)?TEACHER(?:'S)?\s+COMMENT\b/i),
    headTeacherComment: findBlockFieldValue(rows, block, /^\s*(?:HEAD|PRINCIPAL)\s+TEACHER(?:'S)?\s+COMMENT\b/i),
  };
}

function buildBlockRows(
  rows: unknown[][],
  block: { row: number; col: number; endCol: number; endRow: number },
  workbookText: string,
): Array<{ subjectName: string; className: string; teacherName: string; assessmentType: ResultAssessmentType; reportKind: ResultImportReportKind; continuousAssessment: number | null; maximumScore: number | null; examination: number | null; totalScore: number | null; workbookTotal: number | null; grade: string | null; remark: string | null; invalidMarks: string[] }> {
  const subjectRows: Array<{ subjectName: string; className: string; teacherName: string; assessmentType: ResultAssessmentType; reportKind: ResultImportReportKind; continuousAssessment: number | null; maximumScore: number | null; examination: number | null; totalScore: number | null; workbookTotal: number | null; grade: string | null; remark: string | null; invalidMarks: string[] }> = [];
  const boundedRows = rows.slice(block.row, block.endRow);
  const headerRowIndex = boundedRows.findIndex((row) => {
    const rowText = row.map((cell) => normalizeText(cell)).join(" ");
    return /SUBJECTS/i.test(rowText) && /CA\(40\)|CA\b|EXAM|TOTAL|GRADE/i.test(rowText);
  });

  if (headerRowIndex < 0) {
    return subjectRows;
  }

  const header = boundedRows[headerRowIndex] ?? [];
  const localHeader = header.slice(block.col, Math.min(block.endCol, header.length));
  const subheader = boundedRows[headerRowIndex + 1] ?? [];
  const headerLabels = localHeader.map((cell, index) =>
    `${normalizeText(cell)} ${normalizeText(subheader[block.col + index])}`.trim());
  const caIndex = headerLabels.findIndex((cell) => /\bCA(?:\s*\(\s*\d+(?:\.\d+)?\s*\))?/i.test(cell));
  const maximumMatch = headerLabels[caIndex]?.match(/CA\s*\(\s*(\d+(?:\.\d+)?)\s*\)/i);
  const headerMaximumScore = maximumMatch ? Number(maximumMatch[1]) : null;
  const examIndex = headerLabels.findIndex((cell) => /EXAM/i.test(cell));
  const totalIndex = headerLabels.findIndex((cell) => /^TOTAL(?:\b|\s)/i.test(cell));
  const gradeIndex = headerLabels.findIndex((cell) => /\bGRADE\b/i.test(cell));
  const remarkIndex = headerLabels.findIndex((cell) => /REMARK|COMMENT/i.test(cell));
  const teacherIndex = headerLabels.findIndex((cell) => /\bTEACHER\b/i.test(cell) && !/REMARK|COMMENT/i.test(cell));
  const blockText = `${workbookText} ${boundedRows
    .flatMap((row) => row.slice(block.col, Math.min(block.endCol, row.length)))
    .map(normalizeText)
    .join(" ")}`;
  const reportSummaryPatterns = [
    /TOTAL MARKS?\s+(?:OBTAINED|OBTAINABLE)\b/i,
    /CLASS\s+(?:AVERAGE|AVG)\b/i,
    /(?:MAXIMUM|TOTAL)\s+ATTENDANCE\b/i,
    /\bTIMES\s+(?:PRESENT|ABSENT)\b/i,
    /^\s*(?:PRESENT|ABSENT)\b/i,
    /\bTERM\s+ENDING\b/i,
    /\bNEXT\s+TERM\s+(?:BEGINS|STARTS)\b/i,
    /\b(?:CLASS\s+)?TEACHER(?:'S)?\s+COMMENT\b/i,
    /\b(?:HEAD|PRINCIPAL)\s+TEACHER(?:'S)?\s+COMMENT\b/i,
    /\bSTUDENT\s+PERCENTAGE\b/i,
    /\bTOTAL\s+MARKS?\s+(?:OBTAINED|OBTAINABLE)\b/i,
    /\bNAME OF PUPIL:/i,
  ];

  for (let rowIndex = headerRowIndex + 1; rowIndex < boundedRows.length; rowIndex += 1) {
    const row = boundedRows[rowIndex] ?? [];
    const workingSlice = row.slice(block.col, Math.min(block.endCol, row.length));
    const rowText = workingSlice.map((cell) => normalizeText(cell)).join(" ");

    if (!rowText || reportSummaryPatterns.some((pattern) => pattern.test(rowText))) {
      continue;
    }

    if (workingSlice.length === 0) {
      continue;
    }

    const localCaIndex = caIndex;
    const localExamIndex = examIndex;
    const localTeacherIndex = teacherIndex;

    if (localCaIndex < 0 && localExamIndex < 0) {
      continue;
    }

    const subjectName = workingSlice
      .slice(0, Math.min(...[localCaIndex, localExamIndex].filter((index) => index >= 0), workingSlice.length))
      .map((cell) => normalizeText(cell))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!subjectName || /^SUBJECTS$/i.test(subjectName) || /^TOTAL$/i.test(subjectName)) {
      continue;
    }

    const continuousAssessment = localCaIndex >= 0 ? parseNumber(workingSlice[localCaIndex]) : null;
    const maximumScore = headerMaximumScore;
    const examination = localExamIndex >= 0 ? parseNumber(workingSlice[localExamIndex]) : null;
    const workbookTotal = totalIndex >= 0 ? parseNumber(workingSlice[totalIndex]) : null;
    const calculatedTotal = computeTotal(continuousAssessment, examination);
    const invalidMarks = [
      ...(localCaIndex >= 0 && hasNonBlankMark(workingSlice[localCaIndex]) && continuousAssessment === null ? ["CA"] : []),
      ...(localExamIndex >= 0 && hasNonBlankMark(workingSlice[localExamIndex]) && examination === null ? ["examination"] : []),
      ...(totalIndex >= 0 && hasNonBlankMark(workingSlice[totalIndex]) && workbookTotal === null ? ["total"] : []),
    ];
    const grade = gradeIndex >= 0 ? normalizeText(workingSlice[gradeIndex]) || null : null;
    const remark = remarkIndex >= 0 ? normalizeText(workingSlice[remarkIndex]) || null : null;
    if (continuousAssessment === null && examination === null && workbookTotal === null && !grade && !remark) {
      continue;
    }

    const detectedAssessmentType: ResultAssessmentType = continuousAssessment !== null && examination !== null
      ? "Combined"
      : continuousAssessment !== null ? "CA"
        : examination !== null ? "Examination"
          : localCaIndex >= 0 && localExamIndex >= 0 ? "Combined"
            : localCaIndex >= 0 ? "CA" : "Examination";
    const reportKind = detectReportKind(blockText, detectedAssessmentType);
    const assessmentType: ResultAssessmentType = reportKind === "Midterm / Continuous Assessment"
      ? "CA"
      : reportKind === "End-of-Term / Year Report Card" ? "Combined" : detectedAssessmentType;
    subjectRows.push({
      subjectName,
      className: "",
      teacherName: localTeacherIndex >= 0 ? normalizeText(workingSlice[localTeacherIndex] ?? "") : "",
      assessmentType,
      reportKind,
      continuousAssessment,
      maximumScore,
      examination,
      totalScore: workbookTotal ?? calculatedTotal,
      workbookTotal,
      grade,
      remark,
      invalidMarks,
    });
  }

  return subjectRows;
}

function buildRowCandidate(rawRow: WorkbookRow | unknown[]): RowCandidate | null {
  if (Array.isArray(rawRow)) {
    return null;
  }

  const normalizedRow = Object.fromEntries(
    Object.entries(rawRow).map(([key, value]) => [normalizeKey(key), value])
  ) as WorkbookRow;

  const studentName = firstMatchingValue(normalizedRow, [
    "student_name",
    "student",
    "full_name",
    "name",
    "learner_name",
    "pupil_name",
    "candidate_name",
    "student_full_name",
  ]);

  const admissionNumber = firstMatchingValue(normalizedRow, [
    "admission_number",
    "admission_no",
    "admission_id",
    "student_id",
    "studentid",
    "student_number",
    "registration_number",
    "reg_no",
    "id",
  ]);

  const academicYear = firstMatchingValue(normalizedRow, [
    "academic_year",
    "session",
    "school_year",
    "year",
  ]);

  const className = firstMatchingValue(normalizedRow, [
    "class_name",
    "class",
    "classroom",
    "classroom_name",
    "level",
  ]);

  const teacherName = firstMatchingValue(normalizedRow, [
    "teacher_name",
    "teacher",
    "class_teacher",
    "instructor",
    "subject_teacher",
  ]);

  const subjectName = firstMatchingValue(normalizedRow, [
    "subject_name",
    "subject",
    "course",
    "paper",
    "subject_code",
  ]);

  let caValue = firstMatchingValue(normalizedRow, [
      "continuous_assessment",
      "continuous_assessment_score",
      "ca",
      "c_a",
      "test_score",
      "class_assessment",
      "assignment",
    ]);
    const maximumScoreValue = firstMatchingValue(normalizedRow, ["maximum_score", "max_score", "ca_maximum", "ca_max"]);

  let examValue = firstMatchingValue(normalizedRow, [
      "examination",
      "exam",
      "exam_score",
      "final_exam",
      "terminal_exam",
    ]);
  const declaredAssessment = firstMatchingValue(normalizedRow, [
    "assessment_type",
    "assessment",
    "assessment_kind",
  ]).toLowerCase();
  const genericScore = firstMatchingValue(normalizedRow, ["score", "marks", "mark"]);
  if (genericScore && !caValue && !examValue) {
    if (declaredAssessment.includes("ca") || declaredAssessment.includes("midterm") || declaredAssessment.includes("mid-term")) {
      caValue = genericScore;
    } else if (declaredAssessment.includes("exam")) {
      examValue = genericScore;
    }
  }
  const continuousAssessment = caValue === "" ? null : parseNumber(caValue);
  const maximumScore = maximumScoreValue ? parseNumber(maximumScoreValue) : null;
  const examination = examValue === "" ? null : parseNumber(examValue);
  const totalValue = firstMatchingValue(normalizedRow, [
    "total_score",
    "total",
    "total_mark",
    "total_marks",
    "overall_total",
  ]);
  const assessmentType: ResultAssessmentType = continuousAssessment !== null && examination !== null
    ? "Combined"
    : continuousAssessment !== null ? "CA" : "Examination";
  const reportKind = detectReportKind(
    `${declaredAssessment} ${firstMatchingValue(normalizedRow, ["report_type", "report_kind", "assessment_period"])}`,
    assessmentType,
  );

  const term = detectTerm(
    firstMatchingValue(normalizedRow, ["term", "term_name", "academic_term", "result_term"])
  );

  const hasStudentReference = Boolean(studentName || admissionNumber);
  const hasResultReference = Boolean(subjectName || className || teacherName || continuousAssessment !== null || examination !== null);

  if (!hasStudentReference || !hasResultReference) {
    return null;
  }

  return {
    studentName,
    admissionNumber,
    academicYear,
    term,
    assessmentType,
    reportKind,
    className,
    teacherName,
    subjectName,
    continuousAssessment,
    maximumScore,
    examination,
    totalScore: parseNumber(totalValue),
    grade: firstMatchingValue(normalizedRow, ["grade", "letter_grade"]) || null,
    remark: firstMatchingValue(normalizedRow, ["remark", "remarks", "teacher_remark", "comment"]) || null,
    invalidMarks: [
      ...(caValue && continuousAssessment === null ? ["CA"] : []),
      ...(examValue && examination === null ? ["examination"] : []),
      ...(maximumScoreValue && maximumScore === null ? ["maximum score"] : []),
      ...(totalValue && parseNumber(totalValue) === null ? ["total"] : []),
    ],
  };
}

function hasNonBlankMark(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "" && !/^(?:[-—–]|n\/a)$/i.test(String(value).trim());
}

export function getImportScoreWarnings(entry: ResultImportPreviewEntry): string[] {
  const warnings = entry.items.flatMap((item) => {
    const errors = item.invalidMarks?.map((field) => `${item.subjectName}: ${field} mark is not a valid number.`) ?? [];
    const scoreFieldLabels: Record<ResultImportScoreField, string> = {
      continuousAssessment: "CA",
      maximumScore: "Maximum score",
      examination: "Examination",
      totalScore: "Total",
    };
    for (const [field, text] of Object.entries(item.scoreInputText ?? {}) as Array<[ResultImportScoreField, string]>) {
      if (field === "continuousAssessment" && item.assessmentType === "Examination") continue;
      if (field === "maximumScore" && item.assessmentType !== "CA") continue;
      if ((field === "examination" || field === "totalScore") && item.assessmentType === "CA") continue;
      if (!parseScoreInput(text).valid) {
        errors.push(`${item.subjectName}: ${scoreFieldLabels[field]} mark is not a valid number.`);
      }
    }
    errors.push(...validateAssessmentMarks({
      assessment_type: item.assessmentType,
      continuous_assessment: item.continuousAssessment,
      maximum_score: item.maximumScore,
      examination: item.examination,
      total_score: item.totalScore,
      grade: item.grade ?? "",
      remark: item.remark ?? "",
    }).map((message) => `${item.subjectName}: ${message}`));
    return errors;
  });
  const reportDetailLabels: Record<ResultImportReportDetailNumericField, string> = {
    classAverage: "Class average",
    totalMarksObtained: "Total marks obtained",
    totalMarksObtainable: "Total marks obtainable",
    studentPercentage: "Student percentage",
    maximumAttendance: "Maximum attendance",
    timesPresent: "Times present",
    timesAbsent: "Times absent",
  };
  for (const [field, text] of Object.entries(entry.reportDetailInputText ?? {}) as Array<[ResultImportReportDetailNumericField, string]>) {
    if (!parseScoreInput(text).valid) {
      warnings.push(`${reportDetailLabels[field]} must be a valid number.`);
    }
  }
  return warnings;
}

function getImportRosterNameCandidates(student: Student): string[] {
  const firstName = (student.first_name ?? "").trim();
  const firstGivenName = firstName.split(/\s+/).filter(Boolean)[0] ?? "";
  const lastName = (student.last_name ?? "").trim();
  return [
    `${firstName} ${student.middle_name ?? ""} ${lastName}`,
    `${firstName} ${lastName}`,
    `${lastName} ${firstName}`,
    `${firstGivenName} ${lastName}`,
    `${lastName} ${firstGivenName}`,
  ].filter((candidate) => candidate.trim().length > 0);
}

function matchStudent(
  entry: ResultImportPreviewEntry,
  students: Student[]
): StudentMatch {
  const normalizedAdmission = normalizeMatchValue(entry.admissionNumber);

  if (normalizedAdmission) {
    const byAdmission = students.filter((student) =>
      normalizeMatchValue(student.admission_number) === normalizedAdmission
      || normalizeMatchValue(student.id) === normalizedAdmission
    );
    if (byAdmission.length === 1) {
      const candidate = byAdmission[0];
      const normalizedName = normalizeMatchValue(entry.studentName);
      const rosterNames = getImportRosterNameCandidates(candidate).map(normalizeMatchValue);
      if (normalizedName && !rosterNames.includes(normalizedName)) {
        return {
          status: "manual-review",
          matchedStudentId: candidate.id,
          reviewReason: `Admission number ${entry.admissionNumber} matches ${candidate.first_name} ${candidate.last_name}, but the workbook name differs. Confirm the identity before importing.`,
        };
      }
      const workbookClass = normalizeMatchValue(entry.className);
      const rosterClass = normalizeMatchValue(candidate.class_name ?? "");
      if (workbookClass && rosterClass && workbookClass !== rosterClass) {
        return {
          status: "manual-review",
          matchedStudentId: candidate.id,
          reviewReason: `Admission number ${entry.admissionNumber} matches this student, but the workbook class differs. Confirm the identity and class before importing.`,
        };
      }
      return { status: "matched", matchedStudentId: candidate.id };
    }
    if (byAdmission.length > 1) {
      return {
        status: "manual-review",
        reviewReason: `Admission number ${entry.admissionNumber} appears more than once in the roster. Select the correct student manually.`,
      };
    }
  }

  const normalizedName = normalizeMatchValue(entry.studentName);
  if (!normalizedName) {
    return { status: "unmatched" };
  }

  const byName = students.filter((student) =>
    getImportRosterNameCandidates(student).some((candidateName) => normalizeMatchValue(candidateName) === normalizedName)
  );

  const normalizedClass = normalizeMatchValue(entry.className);
  const classMatches = normalizedClass
    ? byName.filter((student) => normalizeMatchValue(student.class_name ?? "") === normalizedClass)
    : [];

  if (classMatches.length === 1) {
    return { status: "matched", matchedStudentId: classMatches[0].id };
  }

  if (byName.length === 1) {
    const candidate = byName[0];
    if (normalizedClass && candidate.class_name && normalizeMatchValue(candidate.class_name) !== normalizedClass) {
      return {
        status: "manual-review",
        matchedStudentId: candidate.id,
        reviewReason: `The name matches ${candidate.first_name} ${candidate.last_name}, but the workbook class differs. Confirm the student before importing.`,
      };
    }
    return { status: "matched", matchedStudentId: candidate.id };
  }

  if (byName.length > 1) {
    return {
      status: "manual-review",
      matchedStudentId: classMatches[0]?.id,
      reviewReason: classMatches.length > 1
        ? "Several students match this name and class. Select the correct student manually."
        : "Several students match this name. Select the correct student manually.",
    };
  }

  return { status: "unmatched" };
}

export function resolveImportStudentMatch(
  entry: ResultImportPreviewEntry,
  students: Student[],
): { status: ResultImportMatchStatus; matchedStudentId?: string; reviewReason?: string } {
  return matchStudent(entry, students);
}

export function reconcileSavedImportStudentMatches(
  entries: ResultImportPreviewEntry[],
  students: Student[],
): ResultImportPreviewEntry[] {
  const mappingWarnings = [
    "No exact admission-number or unique name match found; select the correct student manually.",
    "Name is only a suggested match; confirm the correct student manually.",
    "Student identity or class needs manual confirmation before import.",
  ];
  return entries.map((entry) => {
    const selectedStudentStillExists = Boolean(entry.selectedStudentId)
      && students.some((student) => student.id === entry.selectedStudentId);
    if (selectedStudentStillExists) return entry;

    const match = matchStudent(entry, students);
    const retainedWarnings = entry.warnings.filter((warning) =>
      !mappingWarnings.some((mappingWarning) => warning.startsWith(mappingWarning.split(";")[0]))
      && !warning.startsWith("The name matches ")
      && !warning.startsWith("Admission number ")
    );

    if (match.status === "matched" && match.matchedStudentId) {
      return {
        ...entry,
        matchStatus: "matched",
        matchedStudentId: match.matchedStudentId,
        selectedStudentId: match.matchedStudentId,
        warnings: retainedWarnings,
      };
    }

    if (match.status === "manual-review" && match.matchedStudentId) {
      return {
        ...entry,
        matchStatus: "manual-review",
        matchedStudentId: match.matchedStudentId,
        selectedStudentId: undefined,
        warnings: [...retainedWarnings, match.reviewReason ?? mappingWarnings[2]],
      };
    }

    return {
      ...entry,
      matchStatus: "unmatched",
      matchedStudentId: undefined,
      selectedStudentId: undefined,
      warnings: [...retainedWarnings, "No exact admission-number or safe name match found; select or add the correct student manually."],
    };
  });
}

export async function parseResultWorkbook(
  file: File,
  students: Student[],
  reportKindOverride: ResultImportReportKind = "Unclear",
  selectedSheetName?: string,
  requestedTerm: Result["term"] | null = null,
): Promise<ResultImportPreviewEntry[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const grouped = new Map<string, ResultImportPreviewEntry>();

  const processingSheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = getSheetRows(sheet);
    const metadata = detectSheetMetadata(rows);
    return { sheetName, rows, metadata };
  });
  const selectedSheet = selectedSheetName
    ? processingSheets.find((candidate) => candidate.sheetName === selectedSheetName)
    : [...processingSheets].sort((left, right) =>
      right.metadata.yearRank - left.metadata.yearRank
      || right.metadata.termRank - left.metadata.termRank)[0];
  if (!selectedSheet) {
    throw new Error(`The selected worksheet "${selectedSheetName}" does not exist in this workbook.`);
  }

  [selectedSheet].forEach((sheetCandidate, sheetIndex) => {
    const { sheetName, rows, metadata } = sheetCandidate;
    const studentBlocks = findStudentBlockRanges(rows);

    if (studentBlocks.length > 0) {
      studentBlocks.forEach((block) => {
        const studentName = readBlockStudentName(rows, block);
        if (!isMeaningfulStudentName(studentName)) return;

        const classCell = rows[block.row]?.slice(block.col, Math.min(block.endCol, rows[block.row]?.length ?? 0)).find((cell) => /^CLASS:/i.test(normalizeText(cell))) ?? "";
        const className = normalizeText(classCell).replace(/^CLASS\s*:/i, "").trim();
        const blockHeaderText = rows.slice(Math.max(0, block.row - 2), Math.min(block.endRow, block.row + 8))
          .flatMap((row) => row.slice(block.col, block.endCol))
          .map(normalizeText)
          .join(" ");
        const academicYear = detectAcademicYearFromText(blockHeaderText) || metadata.academicYear;
        const term = detectTermFromText(blockHeaderText) || metadata.term;
        const targetTerm = requestedTerm ?? metadata.term;
        if (targetTerm && term && term !== targetTerm) return;
        const admissionMatch = blockHeaderText.match(/(?:ADMISSION(?:\s+NO\.?|\s+NUMBER)?|REG(?:ISTRATION)?\s+NO\.?)\s*[:#-]\s*([A-Z0-9/-]+)/i);
        const admissionNumber = admissionMatch?.[1]?.trim() ?? "";
        const blockRows = buildBlockRows(rows, block, blockHeaderText);
        const reportDetails = readReportDetails(rows, block);

        const rowStudentKey = `${sheetName}-${block.row}-${block.col}-${studentName}`;
        const existing = grouped.get(rowStudentKey) ?? {
          index: grouped.size,
          studentKey: rowStudentKey,
          studentName,
          admissionNumber,
          academicYear,
          term,
          assessmentType: "Combined",
          reportKind: "Unclear",
          className,
          teacherName: "",
          reportDetails,
          matchStatus: "unmatched",
          warnings: [],
          notices: [],
          items: [],
        } as ResultImportPreviewEntry;

        blockRows.forEach((rowData) => {
          existing.items.push({
            assessmentType: rowData.assessmentType,
            calculationMode: "Manual",
            reportKind: rowData.reportKind,
            subjectName: rowData.subjectName || "Unknown subject",
            className: className || existing.className,
            teacherName: rowData.teacherName || existing.teacherName,
            academicYear: academicYear || existing.academicYear,
            term: term || existing.term,
            continuousAssessment: rowData.continuousAssessment,
            maximumScore: rowData.maximumScore,
            examination: rowData.examination,
            totalScore: rowData.totalScore,
            workbookTotal: rowData.workbookTotal,
            totalDerivedFromComponents: rowData.workbookTotal === null && rowData.totalScore !== null,
            grade: rowData.grade,
            remark: rowData.remark,
            notices: [],
            invalidMarks: rowData.invalidMarks,
          });
        });

        existing.studentName = studentName || existing.studentName;
        existing.admissionNumber = admissionNumber || existing.admissionNumber;
        existing.academicYear = academicYear || existing.academicYear;
        existing.term = term || existing.term;
        existing.className = className || existing.className;
        existing.reportDetails = reportDetails;
        existing.assessmentType = blockRows.length > 0 && blockRows.every((row) => row.assessmentType === "CA")
          ? "CA"
          : blockRows.length > 0 && blockRows.every((row) => row.assessmentType === "Examination")
            ? "Examination"
            : "Combined";
        existing.reportKind = blockRows.length > 0 && blockRows.every((row) => row.reportKind === blockRows[0].reportKind)
          ? blockRows[0].reportKind
          : "Unclear";

        grouped.set(rowStudentKey, existing);
      });
    }

    rows.forEach((rawRow, rowIndex) => {
      const candidate = buildRowCandidate(rawRow);
      if (!candidate) {
        return;
      }

      const rowStudentKey = candidate.admissionNumber || candidate.studentName || `sheet-${sheetIndex}-row-${rowIndex}`;
      const existing = grouped.get(rowStudentKey) ?? {
        index: grouped.size,
        studentKey: rowStudentKey,
        studentName: candidate.studentName || "Unknown student",
        admissionNumber: candidate.admissionNumber,
        academicYear: candidate.academicYear || metadata.academicYear || "",
        term: candidate.term || metadata.term,
        assessmentType: candidate.assessmentType,
        reportKind: candidate.reportKind,
        className: candidate.className,
        teacherName: candidate.teacherName,
        reportDetails: {
          age: "",
          classAverage: null,
          totalMarksObtained: null,
          totalMarksObtainable: null,
          studentPercentage: null,
          maximumAttendance: null,
          timesPresent: null,
          timesAbsent: null,
          termEnding: "",
          nextTermBegins: "",
          classTeacherComment: "",
          headTeacherComment: "",
        },
        matchStatus: "unmatched",
        warnings: [],
        notices: [],
        items: [],
      } as ResultImportPreviewEntry;

      existing.studentName = candidate.studentName || existing.studentName;
      existing.admissionNumber = candidate.admissionNumber || existing.admissionNumber;
      existing.academicYear = candidate.academicYear || existing.academicYear || metadata.academicYear || "";
      existing.term = candidate.term || existing.term || metadata.term;
      existing.className = candidate.className || existing.className;
      existing.teacherName = candidate.teacherName || existing.teacherName;
      existing.items.push({
        assessmentType: candidate.assessmentType,
        calculationMode: "Manual",
        subjectName: candidate.subjectName || "Unknown subject",
        className: candidate.className || existing.className,
        teacherName: candidate.teacherName || existing.teacherName,
        academicYear: candidate.academicYear || existing.academicYear || metadata.academicYear || "",
        term: candidate.term || existing.term || metadata.term,
        reportKind: candidate.reportKind,
        continuousAssessment: candidate.continuousAssessment,
        maximumScore: candidate.maximumScore,
        examination: candidate.examination,
        totalScore: candidate.totalScore,
        grade: candidate.grade,
        remark: candidate.remark,
        notices: [],
        invalidMarks: candidate.invalidMarks,
      });
      existing.reportKind = candidate.reportKind;

      grouped.set(rowStudentKey, existing);
    });
  });

  const preview = Array.from(grouped.values()).map((entry) => {
    const { status, matchedStudentId, reviewReason } = matchStudent(entry, students);
    const warnings: string[] = [];
    const notices: string[] = [];
    entry.matchStatus = status;

    if (!entry.studentName.trim()) {
      warnings.push("Student name missing from workbook.");
    }

    if (!entry.academicYear.trim()) {
      warnings.push("Academic year missing from workbook.");
    }
    if (!entry.term) warnings.push("Term missing from workbook; select the correct term before importing.");

    if (!entry.className.trim()) warnings.push("Class missing from workbook.");
    if (reviewReason) warnings.push(reviewReason);
    else if (status === "manual-review") warnings.push("Name is only a suggested match; confirm the correct student manually.");
    if (status === "unmatched") warnings.push("No exact admission-number or unique name match found; select the correct student manually.");
    const rowKeys = entry.items.map((item) => [
      normalizeMatchValue(item.subjectName),
      item.assessmentType,
      normalizeMatchValue(item.className || entry.className),
      normalizeMatchValue(item.academicYear || entry.academicYear),
      item.term || entry.term || "",
    ].join("|"));
    if (new Set(rowKeys).size !== rowKeys.length) {
      warnings.push("Duplicate subject-assessment rows found for this student.");
    }
    entry.items.forEach((item) => {
      if (item.assessmentType === "CA") {
        if (item.totalScore !== null || item.grade || item.remark) {
          notices.push(`${item.subjectName}: CA entries do not retain final totals, grades, or remarks.`);
        }
        item.totalScore = null;
        item.grade = null;
        item.remark = null;
      }
      if (!item.subjectName.trim() || item.subjectName === "Unknown subject") warnings.push("A subject could not be identified.");
      if (item.continuousAssessment === null || item.examination === null) {
        notices.push(`${item.subjectName}: one or more assessment components are blank and will remain blank.`);
      }
      const calculated = item.assessmentType === "Combined"
        ? computeTotal(item.continuousAssessment, item.examination)
        : null;
      if (calculated !== null && item.totalScore !== null && Math.abs(item.totalScore - calculated) > 0.01) {
        notices.push(`${item.subjectName}: these figures add up to ${calculated}, while the entered total is ${item.totalScore}. You can review the figures or keep the original entry.`);
      } else if (calculated !== null && item.totalScore === null) {
        notices.push(`${item.subjectName}: a calculated total would be ${calculated}, but no total was entered; no total will be added.`);
      }
      if (item.totalDerivedFromComponents) {
        notices.push(`${item.subjectName}: the workbook total was blank; the preview derives ${item.totalScore} from the two valid assessment components.`);
      }
      if (item.workbookTotal === null && item.continuousAssessment === null && item.examination === null) {
        notices.push(`${item.subjectName}: total and assessment components are blank; the total will remain blank.`);
      }
      if (item.grade) {
        const expectedGrade = gradeFromTotal(item.workbookTotal ?? item.totalScore ?? calculated);
        if (expectedGrade && item.grade !== expectedGrade) {
          notices.push(`${item.subjectName}: entered grade ${item.grade} differs from the configured scale suggestion (${expectedGrade}); the entered grade is preserved.`);
        }
      }
      if (!item.grade) {
        notices.push(`${item.subjectName}: no grade was entered; it will remain blank.`);
      }
      if (!item.remark) {
        notices.push(`${item.subjectName}: no remark was entered; it will remain blank.`);
      }
      item.notices = [...new Set(item.notices)];
    });

    if (entry.items.length === 0) {
      warnings.push("No valid subject rows detected.");
    }

    return {
      ...entry,
      matchStatus: status,
      matchedStudentId,
      selectedStudentId: status === "matched" ? matchedStudentId : undefined,
      warnings,
      notices: [...new Set([...entry.notices, ...notices])],
      reportKind: reportKindOverride === "Unclear" ? entry.reportKind : reportKindOverride,
      items: entry.items.map((item) => {
        const reportKind = reportKindOverride === "Unclear" ? item.reportKind : reportKindOverride;
        return {
          ...item,
          reportKind,
          assessmentType: reportKind === "Midterm / Continuous Assessment"
            ? "CA"
            : reportKind === "End-of-Term / Year Report Card" ? "Combined" : item.assessmentType,
        };
      }),
    } satisfies ResultImportPreviewEntry;
  });

  const duplicateRows = new Map<string, Set<number>>();
  preview.forEach((entry, entryIndex) => {
    const studentKey = normalizeMatchValue(entry.selectedStudentId ?? entry.matchedStudentId ?? "")
      || normalizeMatchValue(entry.admissionNumber)
      || normalizeMatchValue(entry.studentName);
    entry.items.forEach((item) => {
      const rowKey = [
        studentKey,
        normalizeMatchValue(item.className || entry.className),
        normalizeMatchValue(item.academicYear || entry.academicYear),
        item.term || entry.term || "",
        item.assessmentType,
        normalizeMatchValue(item.subjectName),
      ].join("|");
      const matchingEntries = duplicateRows.get(rowKey) ?? new Set<number>();
      matchingEntries.add(entryIndex);
      duplicateRows.set(rowKey, matchingEntries);
    });
  });
  preview.forEach((entry) => {
    const studentKey = normalizeMatchValue(entry.selectedStudentId ?? entry.matchedStudentId ?? "")
      || normalizeMatchValue(entry.admissionNumber)
      || normalizeMatchValue(entry.studentName);
    const duplicateSubjects = new Set(entry.items
      .filter((item) => {
        const rowKey = [
          studentKey,
          normalizeMatchValue(item.className || entry.className),
          normalizeMatchValue(item.academicYear || entry.academicYear),
          item.term || entry.term || "",
          item.assessmentType,
          normalizeMatchValue(item.subjectName),
        ].join("|");
        return (duplicateRows.get(rowKey)?.size ?? 0) > 1;
      })
      .map((item) => item.subjectName));
    if (duplicateSubjects.size > 0) {
      entry.warnings = [...new Set([
        ...entry.warnings,
        ...Array.from(duplicateSubjects, (subject) => `${subject}: duplicate workbook result rows found across student blocks.`),
      ])];
    }
  });

  return preview;
}

export async function inspectResultWorkbook(file: File): Promise<ResultWorkbookSheet[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = getSheetRows(sheet);
    const metadata = detectSheetMetadata(rows);
    return {
      name,
      academicYear: metadata.academicYear,
      term: metadata.term,
      terms: metadata.terms,
      studentBlockCount: findStudentBlockRanges(rows).filter((block) => readBlockStudentName(rows, block)).length,
    };
  });
}

export function selectResultWorkbookSheet(
  sheets: ResultWorkbookSheet[],
  academicYear: string,
  term: Result["term"] | null,
): string {
  const matches = sheets.filter((sheet) =>
    (!academicYear || sheet.academicYear === academicYear)
    && (!term || sheet.terms.includes(term)));
  const candidates = matches.length > 0 ? matches : sheets;
  return [...candidates].sort((left, right) =>
    (academicYear ? Number(right.academicYear === academicYear) - Number(left.academicYear === academicYear) : 0)
    || (term ? Number(right.term === term) - Number(left.term === term) : 0)
    || Number(right.academicYear.match(/20\d{2}/)?.[0] ?? "0")
      - Number(left.academicYear.match(/20\d{2}/)?.[0] ?? "0")
    || (right.term === "Third" ? 3 : right.term === "Second" ? 2 : right.term === "First" ? 1 : 0)
      - (left.term === "Third" ? 3 : left.term === "Second" ? 2 : left.term === "First" ? 1 : 0))[0]?.name ?? "";
}

export function summarizeImportPreview(entries: ResultImportPreviewEntry[]): {
  totalStudents: number;
  matchedStudents: number;
  unresolvedStudents: number;
  ignoredStudents: number;
  duplicateRecords: number;
} {
  return entries.reduce(
    (summary, entry) => {
      summary.totalStudents += 1;

      if (entry.included === false) {
        summary.ignoredStudents += 1;
        return summary;
      }

      if (entry.matchStatus === "matched") {
        summary.matchedStudents += 1;
      }

      if (!entry.selectedStudentId || entry.warnings.some((warning) =>
        warning.startsWith("Name is only a suggested match")
        || warning.startsWith("No exact admission-number")
        || warning.startsWith("Admission number ")
        || warning.startsWith("The name matches")
        || warning.startsWith("Several students")
      )) {
        summary.unresolvedStudents += 1;
      }
      if (entry.warnings.some((warning) => warning.toLowerCase().includes("duplicate"))) {
        summary.duplicateRecords += 1;
      }

      return summary;
    },
    { totalStudents: 0, matchedStudents: 0, unresolvedStudents: 0, ignoredStudents: 0, duplicateRecords: 0 }
  );
}
