export type TeacherStatus =
  | "Active"
  | "Inactive"
  | "On Leave"
  | "Retired";

export type EmploymentType =
  | "Full Time"
  | "Part Time"
  | "Contract";

export interface Teacher {
  id: string;

  employee_number: string;

  first_name: string;

  last_name: string;

  middle_name?: string;

  gender: "Male" | "Female";

  date_of_birth: string;

  email: string;

  phone: string;

  address?: string;

  qualification?: string;

  specialization?: string;

  employment_type: EmploymentType;

  date_employed: string;

  passport_url?: string;

  status: TeacherStatus;

  created_at: string;

  updated_at: string;
}