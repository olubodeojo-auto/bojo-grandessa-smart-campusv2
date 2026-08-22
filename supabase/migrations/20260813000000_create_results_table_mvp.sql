create extension if not exists pgcrypto;

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_name text,
  subject_name text,
  teacher_name text,
  academic_year text not null,
  term text not null check (term in ('First', 'Second', 'Third')),
  continuous_assessment numeric(5,2),
  examination numeric(5,2),
  total_score numeric(5,2),
  grade text,
  remark text,
  status text not null default 'Draft' check (status in ('Draft', 'Published', 'Approved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_results_student_id on public.results(student_id);
create index if not exists idx_results_academic_year on public.results(academic_year);
create index if not exists idx_results_term on public.results(term);
create index if not exists idx_results_status on public.results(status);
create index if not exists idx_results_student_year_term on public.results(student_id, academic_year, term);
