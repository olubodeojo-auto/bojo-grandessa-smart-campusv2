create table if not exists public.school_settings (
  school_id uuid primary key,
  school_name text,
  logo_url text,
  motto text,
  address text,
  phone text,
  email text,
  website text,
  head_teacher_name text,
  principal_signature_url text,
  school_stamp_url text,
  report_footer text,
  kindergarten_class_patterns text[] not null default array['nursery','kindergarten','kg'],
  basic_class_patterns text[] not null default array['basic','primary','elementary','jss','sss'],
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.academic_calendar (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  academic_year text not null,
  first_term_start date not null,
  first_term_end date not null,
  first_term_ending date not null,
  first_next_term_begins date not null,
  second_term_start date not null,
  second_term_end date not null,
  second_term_ending date not null,
  second_next_term_begins date not null,
  third_term_start date not null,
  third_term_end date not null,
  third_term_ending date not null,
  third_next_term_begins date not null,
  updated_at timestamptz not null default timezone('utc', now()),
  unique (school_id, academic_year)
);

alter table public.school_settings enable row level security;
alter table public.academic_calendar enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'school_settings'
      and policyname = 'Allow all school_settings access'
  ) then
    create policy "Allow all school_settings access"
      on public.school_settings
      for all
      using (true)
      with check (true);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'academic_calendar'
      and policyname = 'Allow all academic_calendar access'
  ) then
    create policy "Allow all academic_calendar access"
      on public.academic_calendar
      for all
      using (true)
      with check (true);
  end if;
end $$;
