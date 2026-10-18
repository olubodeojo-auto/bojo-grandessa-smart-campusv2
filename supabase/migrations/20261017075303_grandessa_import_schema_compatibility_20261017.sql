begin;

alter table public.results
  add column if not exists class_id uuid,
  add column if not exists subject_id uuid,
  add column if not exists teacher_id uuid,
  add column if not exists assessment_type text,
  add column if not exists calculation_mode text not null default 'Manual',
  add column if not exists maximum_score numeric,
  add column if not exists created_by uuid;

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school_settings(school_id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  academic_year text not null,
  term text not null check (term in ('First', 'Second', 'Third')),
  report_type text not null check (report_type in ('Midterm', 'End-of-Term')),
  calculation_mode text not null default 'Manual' check (calculation_mode in ('Manual', 'Automatic')),
  class_teacher_name text,
  class_teacher_comment text,
  head_teacher_comment text,
  class_average numeric,
  total_marks_obtained numeric,
  total_marks_obtainable numeric,
  student_percentage numeric,
  maximum_attendance numeric,
  times_present numeric,
  times_absent numeric,
  term_ending date,
  next_term_begins date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uidx_report_cards_period_type
  on public.report_cards(school_id, student_id, class_id, academic_year, term, report_type);

notify pgrst, 'reload schema';
commit;
