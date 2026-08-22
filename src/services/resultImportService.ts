import * as XLSX from "xlsx";

import type { Result } from "../types/result";
import type { Student } from "../types/student";
import { computeTotal, gradeFromTotal, remarkFromGrade } from "../utils/resultCalculations";

export type ResultImportMatchStatus = "matched" | "manual-review" | "unmatched";

export type ResultImportItem = {
  subjectName: string;
  className: string;
  teacherName: string;
  academicYear: string;
  term: Result["term"];
  continuousAssessment: number;
  examination: number;
  totalScore: number;
  grade: string;
  remark: string;
};

export type ResultImportPreviewEntry = {
  index: number;
  studentKey: string;
  studentName: string;
  admissionNumber: string;
  academicYear: string;
  term: Result["term"];
  className: string;
  teacherName: string;
  matchStatus: ResultImportMatchStatus;
  matchedStudentId?: string;
  selectedStudentId?: string;
  warnings: string[];
  items: ResultImportItem[];
};

type WorkbookRow = Record<string, unknown>;

type RowCandidate = {
  studentName: string;
  admissionNumber: string;
  academicYear: string;
  term: Result["term"];
  className: string;
  teacherName: string;
  subjectName: string;
  continuousAssessment: number;
  examination: number;
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

function firstMatchingValue(row: WorkbookRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }

  return "";
}

function parseNumber(value: unknown): number {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const normalized = String(value).replace(/[%,$\s]/g, "").trim();
  if (!normalized) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function detectTerm(value: unknown): Result["term"] {
  const normalized = normalizeText(value).toLowerCase();

  if (normalized.includes("third") || normalized.includes("term 3") || normalized.includes("tri")) {
    return "Third";
  }

  if (normalized.includes("second") || normalized.includes("term 2")) {
    return "Second";
  }

  return "First";
}

function detectAcademicYearFromText(value: string): string {
  const match = value.match(/20\d{2}\s*\/\s*20\d{2}/i);
  if (match) {
    return match[0].replace(/\s+/g, "");
  }

  const singleYear = value.match(/20\d{2}/i);
  return singleYear ? singleYear[0] : "";
}

function getBoundedHeaderRows(sheet: XLSX.WorkSheet): unknown[][] {
  const ref = sheet["!ref"];
  if (!ref) {
    return [];
  }

  const range = XLSX.utils.decode_range(ref);
  const maxRow = Math.min(range.e.r, range.s.r + 29);
  const maxCol = Math.min(range.e.c, range.s.c + 39);
  const rows: unknown[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= maxRow; rowIndex += 1) {
    const row: unknown[] = [];

    for (let colIndex = range.s.c; colIndex <= maxCol; colIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = sheet[cellAddress];
      row.push(cell ? cell.v ?? "" : "");
    }

    rows.push(row);
  }

  return rows;
}

function getSheetContentText(sheet: XLSX.WorkSheet): string {
  return getBoundedHeaderRows(sheet)
    .map((row) => row.map((cell) => normalizeText(cell)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");
}

function getSheetHeaderMetadata(sheet: XLSX.WorkSheet): { academicYear: string; term: Result["term"]; yearRank: number; termRank: number; explicitPriority: number } {
  const text = getSheetContentText(sheet);
  const academicYear = detectAcademicYearFromText(text);
  const term = detectTerm(text);
  const yearRank = academicYear ? Number(academicYear.match(/20\d{2}/)?.[0] ?? "0") : 0;
  const termRank = term === "Third" ? 3 : term === "Second" ? 2 : 1;

  const explicitPriority = /FOR:\s*(?:3RD|THIRD)\s*TERM\s*EXAMINATION/i.test(text)
    ? 3
    : /FOR:\s*(?:2ND|SECOND)\s*TERM\s*EXAMINATION/i.test(text)
      ? 2
      : /FOR:\s*(?:1ST|FIRST)\s*TERM\s*EXAMINATION/i.test(text)
        ? 1
        : 0;

  return {
    academicYear,
    term,
    yearRank,
    termRank,
    explicitPriority,
  };
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
  if (!ref) {
    return [];
  }

  const range = XLSX.utils.decode_range(ref);
  const rows: unknown[][] = [];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row: unknown[] = [];

    for (let colIndex = range.s.c; colIndex <= range.e.c; colIndex += 1) {
      const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
      const cell = sheet[cellAddress];
      row.push(cell ? cell.v ?? "" : "");
    }

    rows.push(row);
  }

  return rows;
}

function detectSheetMetadata(rows: unknown[][]): { academicYear: string; term: Result["term"]; yearRank: number; termRank: number } {
  const combinedText = rows
    .map((row) => row.map((cell) => normalizeText(cell)).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ");

  const academicYear = detectAcademicYearFromText(combinedText);
  const term = detectTerm(combinedText);
  const termRank = term === "Third" ? 3 : term === "Second" ? 2 : 1;
  const yearRank = academicYear ? Number(academicYear.match(/20\d{2}/)?.[0] ?? "0") : 0;

  return {
    academicYear,
    term,
    yearRank,
    termRank,
  };
}

function getSheetTermPriority(sheet: XLSX.WorkSheet): number {
  return getSheetHeaderMetadata(sheet).explicitPriority;
}

function findStudentBlockRanges(rows: unknown[][]): Array<{ row: number; col: number; endCol: number; endRow: number }> {
  const positions: Array<{ row: number; col: number }> = [];

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const text = normalizeText(cell);
      const studentName = text.replace(/^NAME OF PUPIL\s*:/i, "").trim();
      if (/^NAME OF PUPIL\s*:/i.test(text) && isMeaningfulStudentName(studentName)) {
        positions.push({ row: rowIndex, col: colIndex });
      }
    });
  });

  const ranges: Array<{ row: number; col: number; endCol: number; endRow: number }> = [];

  for (let i = 0; i < positions.length; i += 1) {
    const current = positions[i];
    const currentRow = rows[current.row] ?? [];
    const sameRowPositions = positions
      .filter((candidate) => candidate.row === current.row)
      .sort((left, right) => left.col - right.col);
    const nextSameRow = sameRowPositions.find((candidate) => candidate.col > current.col);
    const endCol = nextSameRow ? nextSameRow.col : Math.max(current.col + 12, currentRow.length);
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

function buildBlockRows(rows: unknown[][], block: { row: number; col: number; endCol: number; endRow: number }): Array<{ subjectName: string; className: string; teacherName: string; continuousAssessment: number; examination: number; grade: string; remark: string }> {
  const subjectRows: Array<{ subjectName: string; className: string; teacherName: string; continuousAssessment: number; examination: number; grade: string; remark: string }> = [];
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
  const caIndex = localHeader.findIndex((cell) => /CA\(40\)|CA\b/i.test(normalizeText(cell)));
  const examIndex = localHeader.findIndex((cell) => /EXAM/i.test(normalizeText(cell)));
  const teacherIndex = localHeader.findIndex((cell) => /TEACHER/i.test(normalizeText(cell)));

  for (let rowIndex = headerRowIndex + 1; rowIndex < boundedRows.length; rowIndex += 1) {
    const row = boundedRows[rowIndex] ?? [];
    const rowText = row.map((cell) => normalizeText(cell)).join(" ");

    if (!rowText || /TOTAL MARK OBTAINED|TOTAL MARKS OBTAINABLE|NAME OF PUPIL:/i.test(rowText)) {
      continue;
    }

    const workingSlice = row.slice(block.col, Math.min(block.endCol, row.length));

    if (workingSlice.length === 0) {
      continue;
    }

    const localCaIndex = caIndex >= 0 ? caIndex : 2;
    const localExamIndex = examIndex >= 0 ? examIndex : 3;
    const localTeacherIndex = teacherIndex >= 0 ? teacherIndex : Math.max(0, workingSlice.length - 1);

    if (workingSlice.length <= localExamIndex || workingSlice.length <= localCaIndex) {
      continue;
    }

    const subjectName = workingSlice
      .slice(0, Math.min(localCaIndex, workingSlice.length))
      .map((cell) => normalizeText(cell))
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!subjectName || /^SUBJECTS$/i.test(subjectName) || /^TOTAL$/i.test(subjectName)) {
      continue;
    }

    const continuousAssessment = parseNumber(workingSlice[localCaIndex]);
    const examination = parseNumber(workingSlice[localExamIndex]);

    if (!continuousAssessment && !examination) {
      continue;
    }

    const totalScore = computeTotal(continuousAssessment, examination);
    const grade = gradeFromTotal(totalScore);
    const remark = remarkFromGrade(grade);
    const teacherName = normalizeText(workingSlice[localTeacherIndex] ?? "");

    subjectRows.push({
      subjectName,
      className: "",
      teacherName,
      continuousAssessment,
      examination,
      grade,
      remark,
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
    "grade",
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

  const continuousAssessment = parseNumber(
    firstMatchingValue(normalizedRow, [
      "continuous_assessment",
      "continuous_assessment_score",
      "ca",
      "c_a",
      "test_score",
      "class_assessment",
      "assignment",
    ])
  );

  const examination = parseNumber(
    firstMatchingValue(normalizedRow, [
      "examination",
      "exam",
      "exam_score",
      "final_exam",
      "terminal_exam",
      "score",
    ])
  );

  const term = detectTerm(
    firstMatchingValue(normalizedRow, ["term", "term_name", "academic_term", "result_term"])
  );

  const hasStudentReference = Boolean(studentName || admissionNumber);
  const hasResultReference = Boolean(subjectName || className || teacherName || continuousAssessment || examination);

  if (!hasStudentReference || !hasResultReference) {
    return null;
  }

  return {
    studentName,
    admissionNumber,
    academicYear,
    term,
    className,
    teacherName,
    subjectName,
    continuousAssessment,
    examination,
  };
}

function matchStudent(
  entry: ResultImportPreviewEntry,
  students: Student[]
): { status: ResultImportMatchStatus; matchedStudentId?: string } {
  const normalizedAdmission = normalizeMatchValue(entry.admissionNumber);

  if (normalizedAdmission) {
    const byAdmission = students.find((student) => normalizeMatchValue(student.admission_number) === normalizedAdmission);
    if (byAdmission) {
      return { status: "matched", matchedStudentId: byAdmission.id };
    }
  }

  const normalizedName = normalizeMatchValue(entry.studentName);
  if (!normalizedName) {
    return { status: "unmatched" };
  }

  const byName = students.filter((student) => {
    const candidateName = normalizeMatchValue(`${student.first_name} ${student.last_name}`);
    const reversedName = normalizeMatchValue(`${student.last_name} ${student.first_name}`);
    return candidateName === normalizedName || reversedName === normalizedName || candidateName.includes(normalizedName) || normalizedName.includes(candidateName);
  });

  if (byName.length === 1) {
    return { status: "manual-review", matchedStudentId: byName[0].id };
  }

  if (byName.length > 1) {
    return { status: "manual-review" };
  }

  return { status: "unmatched" };
}

export async function parseResultWorkbook(file: File, students: Student[]): Promise<ResultImportPreviewEntry[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const grouped = new Map<string, ResultImportPreviewEntry>();

  const sheetCandidates = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const metadata = getSheetHeaderMetadata(sheet);

    return {
      sheetName,
      sheet,
      metadata,
      rows: undefined as unknown[][] | undefined,
    };
  }).sort((left, right) => {
    const explicitPriority = getSheetTermPriority(right.sheet) - getSheetTermPriority(left.sheet);
    if (explicitPriority !== 0) {
      return explicitPriority;
    }

    if (right.metadata.termRank !== left.metadata.termRank) {
      return right.metadata.termRank - left.metadata.termRank;
    }

    return right.metadata.yearRank - left.metadata.yearRank;
  });

  const selectedSheetCandidate = sheetCandidates.find((candidate) => getSheetTermPriority(candidate.sheet) > 0) ?? sheetCandidates[0];
  const selectedRows = selectedSheetCandidate ? getSheetRows(selectedSheetCandidate.sheet) : [];
  const selectedMetadata: { academicYear: string; term: Result["term"]; yearRank: number; termRank: number } = selectedSheetCandidate
    ? detectSheetMetadata(selectedRows)
    : { academicYear: "", term: "First", yearRank: 0, termRank: 1 };
  const processingSheets = selectedSheetCandidate ? [{ ...selectedSheetCandidate, rows: selectedRows, metadata: selectedMetadata }] : [];

  processingSheets.forEach((sheetCandidate, sheetIndex) => {
    const { sheetName, rows, metadata } = sheetCandidate;
    const studentBlocks = findStudentBlockRanges(rows);

    if (studentBlocks.length > 0) {
      studentBlocks.forEach((block) => {
        const nameCell = rows[block.row]?.[block.col];
        const studentName = normalizeText(nameCell).replace(/^NAME OF PUPIL\s*:/i, "").trim();

        if (!isMeaningfulStudentName(studentName)) {
          return;
        }

        const classCell = rows[block.row]?.slice(block.col, Math.min(block.endCol, rows[block.row]?.length ?? 0)).find((cell) => /^CLASS:/i.test(normalizeText(cell))) ?? "";
        const className = normalizeText(classCell).replace(/^CLASS\s*:/i, "").trim();
        const blockRows = buildBlockRows(rows, block);

        if (blockRows.length === 0) {
          return;
        }

        const rowStudentKey = `${sheetName}-${block.row}-${block.col}-${studentName}`;
        const existing = grouped.get(rowStudentKey) ?? {
          index: grouped.size,
          studentKey: rowStudentKey,
          studentName,
          admissionNumber: "",
          academicYear: metadata.academicYear,
          term: metadata.term,
          className,
          teacherName: "",
          matchStatus: "unmatched",
          warnings: [],
          items: [],
        } as ResultImportPreviewEntry;

        blockRows.forEach((rowData) => {
          const totalScore = computeTotal(rowData.continuousAssessment, rowData.examination);
          existing.items.push({
            subjectName: rowData.subjectName || "Unknown subject",
            className: className || existing.className,
            teacherName: rowData.teacherName || existing.teacherName,
            academicYear: metadata.academicYear || existing.academicYear,
            term: metadata.term || existing.term,
            continuousAssessment: rowData.continuousAssessment,
            examination: rowData.examination,
            totalScore,
            grade: rowData.grade,
            remark: rowData.remark,
          });
        });

        existing.studentName = studentName || existing.studentName;
        existing.academicYear = metadata.academicYear || existing.academicYear;
        existing.term = metadata.term || existing.term;
        existing.className = className || existing.className;

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
        className: candidate.className,
        teacherName: candidate.teacherName,
        matchStatus: "unmatched",
        warnings: [],
        items: [],
      } as ResultImportPreviewEntry;

      const totalScore = computeTotal(candidate.continuousAssessment, candidate.examination);
      const grade = gradeFromTotal(totalScore);
      const remark = remarkFromGrade(grade);

      existing.studentName = candidate.studentName || existing.studentName;
      existing.admissionNumber = candidate.admissionNumber || existing.admissionNumber;
      existing.academicYear = candidate.academicYear || existing.academicYear || metadata.academicYear || "";
      existing.term = candidate.term || existing.term || metadata.term;
      existing.className = candidate.className || existing.className;
      existing.teacherName = candidate.teacherName || existing.teacherName;
      existing.items.push({
        subjectName: candidate.subjectName || "Unknown subject",
        className: candidate.className || existing.className,
        teacherName: candidate.teacherName || existing.teacherName,
        academicYear: candidate.academicYear || existing.academicYear || metadata.academicYear || "",
        term: candidate.term || existing.term || metadata.term,
        continuousAssessment: candidate.continuousAssessment,
        examination: candidate.examination,
        totalScore,
        grade,
        remark,
      });

      grouped.set(rowStudentKey, existing);
    });
  });

  const preview = Array.from(grouped.values()).map((entry) => {
    const { status, matchedStudentId } = matchStudent(entry, students);
    const warnings: string[] = [];

    if (!entry.studentName.trim()) {
      warnings.push("Student name missing from workbook.");
    }

    if (!entry.academicYear.trim()) {
      warnings.push("Academic year missing from workbook.");
    }

    if (entry.items.length === 0) {
      warnings.push("No valid subject rows detected.");
    }

    return {
      ...entry,
      matchStatus: status,
      matchedStudentId,
      selectedStudentId: matchedStudentId,
      warnings,
    } satisfies ResultImportPreviewEntry;
  });

  return preview.filter((entry) => entry.items.length > 0);
}

export function summarizeImportPreview(entries: ResultImportPreviewEntry[]): {
  totalStudents: number;
  matchedStudents: number;
  needsReview: number;
} {
  return entries.reduce(
    (summary, entry) => {
      summary.totalStudents += 1;

      if (entry.matchStatus === "matched") {
        summary.matchedStudents += 1;
      }

      if (entry.matchStatus === "manual-review" || entry.matchStatus === "unmatched") {
        summary.needsReview += 1;
      }

      return summary;
    },
    { totalStudents: 0, matchedStudents: 0, needsReview: 0 }
  );
}
