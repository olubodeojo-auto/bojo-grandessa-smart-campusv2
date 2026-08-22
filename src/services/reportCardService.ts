import { getAttendanceByStudent } from "./attendanceService";
import { getClasses } from "./classService";
import { getCalendarTermConfig, type ReportTerm as CalendarTerm } from "../config/grandessaCalendar";
import grandessaGradingScale from "../config/grandessaGrading";
import { supabase } from "../lib/supabase";
import { getResults } from "./resultService";
import { getAcademicCalendarByYear, getSchoolSettings } from "./schoolSettingsService";
import { getStudents } from "./studentService";
import { getSubjects } from "./subjectService";
import { computeTotal, gradeFromTotal, remarkFromGrade } from "../utils/resultCalculations";
import { resolveTemplateForClass } from "./reportTemplateEngine";
import type { ReportCardData, ReportHistoryBySession, ReportHistoryItem, ReportTerm, SubjectReportLine } from "../types/reportCard";
import type { Result } from "../types/result";

type ReportCardRecord = {
  class_teacher_comment?: string | null;
  teacher_comment?: string | null;
  head_teacher_comment?: string | null;
  principal_comment?: string | null;
  academic_year?: string | null;
  term?: string | null;
  class_id?: string | null;
};

type ReportDependencies = {
  students: Awaited<ReturnType<typeof getStudents>>;
  classes: Awaited<ReturnType<typeof getClasses>>;
  subjects: Awaited<ReturnType<typeof getSubjects>>;
  results: Awaited<ReturnType<typeof getResults>>;
};

let dependenciesCache: Promise<ReportDependencies> | null = null;

function loadReportDependencies(): Promise<ReportDependencies> {
  if (!dependenciesCache) {
    dependenciesCache = Promise.all([
      getStudents(),
      getClasses(),
      getSubjects(),
      getResults(),
    ]).then(([students, classes, subjects, results]) => ({
      students,
      classes,
      subjects,
      results,
    }));
  }

  return dependenciesCache;
}

function normalizeTerm(term: string): ReportTerm {
  if (term === "First" || term === "Second" || term === "Third") {
    return term;
  }

  return "First";
}

function classLabel(result: Result, classMap: Map<string, { class_name: string }>): string {
  const value = result.class_id ? classMap.get(result.class_id) : undefined;

  if (!value) {
    return result.class_name?.trim() || "Unknown Class";
  }

  return value.class_name;
}

function inTermWindow(dateText: string, termConfig: { startDate: string; endDate: string }): boolean {
  const date = new Date(dateText);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const start = new Date(`${termConfig.startDate}T00:00:00`);
  const end = new Date(`${termConfig.endDate}T23:59:59`);

  return date >= start && date <= end;
}

function countWeekdays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return 0;
  }

  let total = 0;
  const cursor = new Date(start);

  while (cursor <= end) {
    const day = cursor.getDay();

    if (day !== 0 && day !== 6) {
      total += 1;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return total;
}

async function getReportCardRecord(
  studentId: string,
  academicYear: string,
  term: ReportTerm,
  classId: string
): Promise<ReportCardRecord | null> {
  try {
    const { data, error } = await supabase
      .from("report_cards")
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      return null;
    }

    const exactMatch = (data as ReportCardRecord[]).find((record) => {
      const sessionMatches = !record.academic_year || record.academic_year === academicYear;
      const termMatches = !record.term || record.term === term;
      const classMatches = !record.class_id || record.class_id === classId;

      return sessionMatches && termMatches && classMatches;
    });

    return exactMatch ?? ((data[0] ?? null) as ReportCardRecord | null);
  } catch {
    return null;
  }
}

export async function getReportHistoryByStudent(studentId: string): Promise<ReportHistoryBySession[]> {
  const { results: allResults, classes } = await loadReportDependencies();
  const classMap = new Map(classes.map((item) => [item.id, { class_name: item.class_name }]));

  const rows = allResults
    .filter((result) => result.student_id === studentId)
    .reduce<Map<string, ReportHistoryItem>>((acc, row) => {
      const key = `${row.academic_year}|${row.term}|${row.class_id}`;
      const existing = acc.get(key);

      if (existing) {
        existing.resultCount += 1;
        existing.publishedCount += row.status === "Published" ? 1 : 0;
        if (new Date(row.updated_at).getTime() > new Date(existing.latestUpdatedAt).getTime()) {
          existing.latestUpdatedAt = row.updated_at;
        }
      } else {
        acc.set(key, {
          academicYear: row.academic_year,
          term: normalizeTerm(row.term),
          classId: row.class_id ?? row.class_name ?? "",
          className: classLabel(row, classMap),
          resultCount: 1,
          publishedCount: row.status === "Published" ? 1 : 0,
          latestUpdatedAt: row.updated_at,
        });
      }

      return acc;
    }, new Map())
    .values();

  const sessionsMap = new Map<string, ReportHistoryItem[]>();

  Array.from(rows).forEach((item) => {
    const list = sessionsMap.get(item.academicYear) ?? [];
    list.push(item);
    sessionsMap.set(item.academicYear, list);
  });

  const orderedTerms: ReportTerm[] = ["First", "Second", "Third"];

  return Array.from(sessionsMap.entries())
    .map(([academicYear, entries]) => ({
      academicYear,
      entries: [...entries].sort(
        (a, b) => orderedTerms.indexOf(a.term) - orderedTerms.indexOf(b.term)
      ),
    }))
    .sort((a, b) => b.academicYear.localeCompare(a.academicYear));
}

export async function buildStudentReportCard(
  studentId: string,
  academicYear: string,
  term: ReportTerm
): Promise<ReportCardData | null> {
  const [{ students, classes, subjects, results: allResults }, attendanceRows] = await Promise.all([
    loadReportDependencies(),
    getAttendanceByStudent(studentId),
  ]);

  const student = students.find((item) => item.id === studentId);

  if (!student) {
    return null;
  }

  const scopedResults = allResults.filter(
    (result) => result.student_id === studentId && result.academic_year === academicYear && result.term === term
  );

  if (scopedResults.length === 0) {
    return null;
  }

  const classById = new Map(classes.map((item) => [item.id, item]));
  const subjectById = new Map(subjects.map((item) => [item.id, item]));

  const classId = scopedResults[0]?.class_id ?? "";
  const classEntity = classId ? classById.get(classId) : undefined;
  const resultClassName = scopedResults.find((result) => {
    const value = result.class_name?.trim();
    return value && value.toLowerCase() !== "unknown" && value.toLowerCase() !== "unknown class";
  })?.class_name?.trim();
  const className = classEntity?.class_name?.trim() || student.class_name?.trim() || resultClassName || "";
  const reportCardRecord = await getReportCardRecord(studentId, academicYear, term, classId);

  const cohortRows = allResults.filter(
    (row) => row.class_id === classId && row.academic_year === academicYear && row.term === term
  );

  const lines: SubjectReportLine[] = scopedResults
    .map((result) => {
      const subject = result.subject_id ? subjectById.get(result.subject_id) : undefined;

      return {
        resultId: result.id,
        subjectId: result.subject_id ?? result.subject_name ?? "",
        subjectName: subject?.subject_name ?? result.subject_name ?? "Unknown Subject",
        subjectCode: subject?.subject_code ?? "",
        continuousAssessment: result.continuous_assessment,
        examination: result.examination,
        totalScore: result.total_score,
        grade: result.grade,
        teacherRemark: result.remark,
        teacherName: result.teacher_name,
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName));

  const totalMarksObtained = Number(lines.reduce((sum, line) => sum + line.totalScore, 0).toFixed(2));
  const totalMarksObtainable = lines.length * 100;
  const studentPercentage = totalMarksObtainable > 0
    ? Number(((totalMarksObtained / totalMarksObtainable) * 100).toFixed(2))
    : 0;

  const uniqueStudents = new Map<string, Result[]>();

  cohortRows.forEach((row) => {
    const list = uniqueStudents.get(row.student_id) ?? [];
    list.push(row);
    uniqueStudents.set(row.student_id, list);
  });

  const classPercentages = Array.from(uniqueStudents.values()).map((rows) => {
    const obtained = rows.reduce((sum, row) => sum + row.total_score, 0);
    const obtainable = rows.length * 100;

    return obtainable > 0 ? (obtained / obtainable) * 100 : 0;
  });

  const classAverage = classPercentages.length > 0
    ? Number((classPercentages.reduce((sum, value) => sum + value, 0) / classPercentages.length).toFixed(2))
    : 0;

  const [calendar, schoolSettings] = await Promise.all([
    getAcademicCalendarByYear(academicYear),
    getSchoolSettings(),
  ]);
  const termConfig = getCalendarTermConfig(calendar, term as CalendarTerm);
  const attendanceScoped = attendanceRows.filter((row) => inTermWindow(row.attendance_date, termConfig));
  const present = attendanceScoped.filter((row) => row.status === "Present").length;
  const absent = attendanceScoped.filter((row) => row.status === "Absent").length;

  const attendance = {
    maximumAttendance: countWeekdays(termConfig.startDate, termConfig.endDate),
    timesPresent: present,
    timesAbsent: absent,
  };

  const template = resolveTemplateForClass(className, schoolSettings);

  return {
    student,
    schoolSettings,
    className,
    academicYear,
    term,
    termEnding: termConfig.termEnding,
    nextTermBegins: termConfig.nextTermBegins,
    lines,
    totalMarksObtained,
    totalMarksObtainable,
    studentPercentage,
    classAverage,
    classTeacherComment: reportCardRecord?.class_teacher_comment ?? reportCardRecord?.teacher_comment ?? "",
    headTeacherComment: reportCardRecord?.head_teacher_comment ?? reportCardRecord?.principal_comment ?? "",
    attendance,
    gradingScale: grandessaGradingScale,
    template,
  };
}

export function normalizeResultInput(
  continuousAssessment: number,
  examination: number
): { total: number; grade: string; remark: string } {
  const total = computeTotal(continuousAssessment, examination);
  const grade = gradeFromTotal(total);
  const remark = remarkFromGrade(grade);

  return { total, grade, remark };
}
