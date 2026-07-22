import type { GradeBand } from "../config/grandessaGrading";
import type { SchoolSettings } from "./schoolSettings";
import type { Student } from "./student";

export type ReportTerm = "First" | "Second" | "Third";

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
  continuousAssessment: number;
  examination: number;
  totalScore: number;
  grade: string;
  teacherRemark: string;
}

export interface AttendanceSummary {
  maximumAttendance: number;
  timesPresent: number;
  timesAbsent: number;
}

export interface ReportCardData {
  student: Student;
  schoolSettings: SchoolSettings;
  className: string;
  academicYear: string;
  term: ReportTerm;
  termEnding: string;
  nextTermBegins: string;
  lines: SubjectReportLine[];
  totalMarksObtained: number;
  totalMarksObtainable: number;
  studentPercentage: number;
  classAverage: number;
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
  resultCount: number;
  publishedCount: number;
  latestUpdatedAt: string;
}

export interface ReportHistoryBySession {
  academicYear: string;
  entries: ReportHistoryItem[];
}
