export type StudentStatus =
  | "Active"
  | "Inactive"
  | "Graduated"
  | "Transferred"
  | "Suspended";

export type Gender =
  | "Male"
  | "Female";

export interface Student {
  id: string;

  school_id: string;

  admission_number: string;

  first_name: string;

  last_name: string;

  middle_name?: string;

  gender: Gender;

  date_of_birth: string;

  class_name?: string;

  parent_name?: string;

  parent_phone?: string;

  email?: string;

  phone?: string;

  address?: string;

  passport_url?: string;

  blood_group?: string;

  genotype?: string;

  allergies?: string;

  medical_notes?: string;

  admission_date: string;

  status: StudentStatus;

  created_at: string;

  updated_at: string;
}