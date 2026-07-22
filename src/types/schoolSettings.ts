export interface SchoolSettings {
  school_id: string;
  school_name: string;
  logo_url: string | null;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  head_teacher_name: string | null;
  principal_signature_url: string | null;
  school_stamp_url: string | null;
  report_footer: string | null;
  kindergarten_class_patterns: string[];
  basic_class_patterns: string[];
  updated_at?: string;
}

export interface AcademicCalendarRow {
  school_id: string;
  academic_year: string;
  first_term_start: string;
  first_term_end: string;
  first_term_ending: string;
  first_next_term_begins: string;
  second_term_start: string;
  second_term_end: string;
  second_term_ending: string;
  second_next_term_begins: string;
  third_term_start: string;
  third_term_end: string;
  third_term_ending: string;
  third_next_term_begins: string;
  updated_at?: string;
}
