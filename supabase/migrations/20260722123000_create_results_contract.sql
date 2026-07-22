create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.students') is null then
    raise exception 'Missing required table: public.students';
  end if;

  if to_regclass('public.classes') is null then
    raise exception 'Missing required table: public.classes';
  end if;

  if to_regclass('public.subjects') is null then
    raise exception 'Missing required table: public.subjects';
  end if;

  if to_regclass('public.teachers') is null then
    raise exception 'Missing required table: public.teachers';
  end if;

  if to_regclass('public.users') is null then
    raise exception 'Missing required table: public.users';
  end if;

  if to_regclass('public.roles') is null then
    raise exception 'Missing required table: public.roles';
  end if;
end $$;

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  academic_year text not null,
  term text not null check (term in ('First', 'Second', 'Third')),
  continuous_assessment numeric(5,2) not null check (continuous_assessment >= 0 and continuous_assessment <= 40),
  examination numeric(5,2) not null check (examination >= 0 and examination <= 60),
  total_score numeric(5,2) not null check (total_score >= 0 and total_score <= 100),
  grade text not null,
  remark text not null,
  teacher_id uuid not null references public.teachers(id) on delete restrict,
  status text not null default 'Draft' check (status in ('Draft', 'Published', 'Approved')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_results_student_id on public.results(student_id);
create index if not exists idx_results_class_id on public.results(class_id);
create index if not exists idx_results_subject_id on public.results(subject_id);
create index if not exists idx_results_teacher_id on public.results(teacher_id);
create index if not exists idx_results_academic_year on public.results(academic_year);
create index if not exists idx_results_term on public.results(term);
create index if not exists idx_results_status on public.results(status);
create index if not exists idx_results_student_session_term on public.results(student_id, academic_year, term);
create index if not exists idx_results_class_subject_session_term on public.results(class_id, subject_id, academic_year, term);

create or replace function public.set_results_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_results_set_updated_at on public.results;

create trigger trg_results_set_updated_at
before update on public.results
for each row
execute function public.set_results_updated_at();

alter table public.results enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'results'
      and policyname = 'Results read by same school'
  ) then
    create policy "Results read by same school"
      on public.results
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.users u
          join public.students s on s.id = results.student_id
          where u.id = auth.uid()
            and u.school_id = s.school_id
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'results'
      and policyname = 'Results write by staff in same school'
  ) then
    create policy "Results write by staff in same school"
      on public.results
      for all
      to authenticated
      using (
        exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          join public.students s on s.id = results.student_id
          where u.id = auth.uid()
            and u.school_id = s.school_id
            and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'teacher', 'admin')
        )
      )
      with check (
        exists (
          select 1
          from public.users u
          join public.roles r on r.id = u.role_id
          join public.students s on s.id = results.student_id
          join public.classes c on c.id = results.class_id
          join public.subjects sub on sub.id = results.subject_id
          join public.teachers t on t.id = results.teacher_id
          where u.id = auth.uid()
            and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'teacher', 'admin')
            and u.school_id = s.school_id
            and u.school_id = c.school_id
            and u.school_id = sub.school_id
            and u.school_id = t.school_id
        )
      );
  end if;
end $$;
