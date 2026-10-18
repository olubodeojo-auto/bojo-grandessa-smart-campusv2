import type { GradeBand } from "../config/grandessaGrading";
import type { SchoolSettings } from "./schoolSettings";
import type { Student } from "./student";

export type ReportTerm = "First" | "Second" | "Third";
export type ReportType = "Midterm" | "End-of-Term";

export interface ReportTemplateSummary {
  id: string;
  name: string;
  level: string;
  headingText: string[];
  tableLabels: string[];
}

export interface SubjectReportLine {
  resultId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  continuousAssessment: number | null;
  maximumScore: number | null;
  examination: number | null;
  totalScore: number | null;
  grade: string | null;
  teacherRemark: string;
  teacherName?: string;
}

export interface AttendanceSummary {
  maximumAttendance: number | null;
  timesPresent: number | null;
  timesAbsent: number | null;
}

export interface ReportCardData {
  reportType: ReportType;
  classId: string;
  calculationMode: "Manual" | "Automatic";
  student: Student;
  schoolSettings: SchoolSettings;
  className: string;
  classTeacherName: string;
  academicYear: string;
  term: ReportTerm;
  termEnding: string;
  nextTermBegins: string;
  lines: SubjectReportLine[];
  totalMarksObtained: number | null;
  totalMarksObtainable: number | null;
  studentPercentage: number | null;
  classAverage: number | null;
  reportTotalMarksObtained: number | null;
  reportTotalMarksObtainable: number | null;
  reportStudentPercentage: number | null;
  classTeacherComment: string;
  headTeacherComment: string;
  attendance: AttendanceSummary;
  gradingScale: GradeBand[];
  template: ReportTemplateSummary;
}

export interface ReportHistoryItem {
  academicYear: string;
  term: ReportTerm;
  classId: string;
  className: string;
  reportType: ReportType;
  resultCount: number;
  publishedCount: number;
  latestUpdatedAt: string;
}

export interface ReportHistoryBySession {
  academicYear: string;
  entries: ReportHistoryItem[];
}
