export type AttendanceStatus =
  | "Present"
  | "Absent"
  | "Late"
  | "Excused";

export interface Attendance {
  id: string;

  student_id: string;

  class_id: string;

  attendance_date: string;

  status: AttendanceStatus;

  check_in_time?: string;

  check_out_time?: string;

  remarks?: string;

  recorded_by?: string;

  created_at: string;

  updated_at: string;
}