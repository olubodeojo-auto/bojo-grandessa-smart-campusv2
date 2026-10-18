do $$
begin
  if to_regclass('public.school_settings') is null
    or to_regclass('public.students') is null
    or to_regclass('public.classes') is null
    or to_regclass('public.academic_sessions') is null
    or to_regclass('public.terms') is null
    or to_regclass('public.results') is null
    or to_regclass('public.users') is null
    or to_regclass('public.user_roles') is null
    or to_regclass('public.roles') is null
  then
    raise exception 'Report-card storage requires school_settings, students, classes, academic_sessions, terms, results, users, user_roles, and roles.';
  end if;

  if to_regprocedure('public.is_assignment_admin()') is null
    or to_regprocedure('public.is_parent_linked_student(uuid)') is null
  then
    raise exception 'Report-card storage requires the existing administrator and parent-link authorization helpers.';
  end if;

  if to_regclass('public.report_cards') is not null then
    if exists (
      select 1
      from public.report_cards
    ) and (
      not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'report_cards' and column_name = 'report_type'
      )
      or not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'report_cards' and column_name = 'calculation_mode'
      )
    ) then
      raise exception 'Existing report cards lack report_type or calculation_mode. Classify existing rows explicitly before applying this migration.';
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'report_cards' and column_name = 'school_id'
    ) or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'report_cards' and column_name = 'student_id'
    ) or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'report_cards' and column_name = 'class_id'
    ) or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'report_cards' and column_name = 'term_id'
    ) or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'report_cards' and column_name = 'academic_year'
    ) or not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'report_cards' and column_name = 'term'
    ) then
      raise exception 'Existing report_cards is missing required application identity columns. Reconcile its schema without removing existing records before applying this migration.';
    end if;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'school_settings'
      and column_name = 'school_id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'session_name'
      and data_type in ('text', 'character varying')
      and udt_name in ('text', 'varchar')
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'academic_session_id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'term_name'
      and data_type in ('text', 'character varying')
      and udt_name in ('text', 'varchar')
  ) then
    raise exception 'Report-card storage requires UUID school_settings.school_id, student/class/session/term IDs, academic_sessions.session_name, and terms.academic_session_id/term_name.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.terms'::regclass
      and contype = 'f'
      and conkey = array[
        (select attnum from pg_attribute where attrelid = 'public.terms'::regclass and attname = 'academic_session_id')
      ]::smallint[]
      and confrelid = 'public.academic_sessions'::regclass
      and confkey = array[
        (select attnum from pg_attribute where attrelid = 'public.academic_sessions'::regclass and attname = 'id')
      ]::smallint[]
  ) then
    raise exception 'terms.academic_session_id must reference academic_sessions.id before report-card storage can be installed.';
  end if;
end;
$$;

create table if not exists public.report_cards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school_settings(school_id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  term_id uuid not null references public.terms(id) on delete restrict,
  academic_year text not null,
  term text not null check (term in ('First', 'Second', 'Third')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.validate_report_card_term()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.terms t
    join public.academic_sessions s on s.id = t.academic_session_id
    where t.id = new.term_id
      and t.term_name = new.term || ' Term'
      and s.session_name = new.academic_year
  ) then
    raise exception 'Report-card term_id must match the selected academic year and term.';
  end if;
  return new;
end;
$$;
revoke all on function public.validate_report_card_term() from public, anon;
grant execute on function public.validate_report_card_term() to authenticated;

drop trigger if exists report_cards_validate_term on public.report_cards;
create trigger report_cards_validate_term
  before insert or update of term_id, academic_year, term on public.report_cards
  for each row execute function public.validate_report_card_term();

do $$
begin
  if exists (
    select 1
    from public.report_cards rc
    left join public.school_settings ss on ss.school_id = rc.school_id
    where ss.school_id is null
  ) or exists (
    select 1
    from public.report_cards rc
    left join public.students s on s.id = rc.student_id
    where s.id is null
  ) or exists (
    select 1
    from public.report_cards rc
    left join public.classes c on c.id = rc.class_id
    where c.id is null
  ) or exists (
    select 1
    from public.report_cards rc
    left join public.terms t on t.id = rc.term_id
    left join public.academic_sessions s on s.id = t.academic_session_id
    where t.id is null
      or s.id is null
      or t.term_name is distinct from rc.term || ' Term'
      or s.session_name is distinct from rc.academic_year
  ) or exists (
    select 1
    from public.report_cards
    where academic_year is null or term is null
  ) then
    raise exception 'Existing report-card references or period values do not resolve to school_settings, students, classes, and terms. Resolve them before adding constraints.';
  end if;

  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_school_id_fkey'
      and (
        contype <> 'f'
        or confrelid <> 'public.school_settings'::regclass
        or conkey <> array[(select attnum from pg_attribute where attrelid = 'public.report_cards'::regclass and attname = 'school_id')]::smallint[]
        or confkey <> array[(select attnum from pg_attribute where attrelid = 'public.school_settings'::regclass and attname = 'school_id')]::smallint[]
      )
  ) or exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_student_id_fkey'
      and (
        contype <> 'f'
        or confrelid <> 'public.students'::regclass
        or conkey <> array[(select attnum from pg_attribute where attrelid = 'public.report_cards'::regclass and attname = 'student_id')]::smallint[]
        or confkey <> array[(select attnum from pg_attribute where attrelid = 'public.students'::regclass and attname = 'id')]::smallint[]
      )
  ) or exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_class_id_fkey'
      and (
        contype <> 'f'
        or confrelid <> 'public.classes'::regclass
        or conkey <> array[(select attnum from pg_attribute where attrelid = 'public.report_cards'::regclass and attname = 'class_id')]::smallint[]
        or confkey <> array[(select attnum from pg_attribute where attrelid = 'public.classes'::regclass and attname = 'id')]::smallint[]
      )
  ) or exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_term_id_fkey'
      and (
        contype <> 'f'
        or confrelid <> 'public.terms'::regclass
        or conkey <> array[(select attnum from pg_attribute where attrelid = 'public.report_cards'::regclass and attname = 'term_id')]::smallint[]
        or confkey <> array[(select attnum from pg_attribute where attrelid = 'public.terms'::regclass and attname = 'id')]::smallint[]
      )
  ) then
    raise exception 'An existing report-card foreign-key constraint name points to a different relationship. Reconcile the constraint explicitly before applying this migration.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_school_id_fkey'
  ) then
    alter table public.report_cards
      add constraint report_cards_school_id_fkey
      foreign key (school_id) references public.school_settings(school_id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_student_id_fkey'
  ) then
    alter table public.report_cards
      add constraint report_cards_student_id_fkey
      foreign key (student_id) references public.students(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_class_id_fkey'
  ) then
    alter table public.report_cards
      add constraint report_cards_class_id_fkey
      foreign key (class_id) references public.classes(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_term_id_fkey'
  ) then
    alter table public.report_cards
      add constraint report_cards_term_id_fkey
      foreign key (term_id) references public.terms(id) on delete restrict;
  end if;
end;
$$;

alter table public.report_cards
  alter column school_id set not null,
  alter column student_id set not null,
  alter column class_id set not null,
  alter column term_id set not null,
  alter column academic_year set not null,
  alter column term set not null;

alter table public.report_cards
  add column if not exists report_type text not null default 'End-of-Term',
  add column if not exists calculation_mode text not null default 'Manual',
  add column if not exists class_teacher_name text,
  add column if not exists class_teacher_comment text,
  add column if not exists head_teacher_comment text,
  add column if not exists class_average numeric,
  add column if not exists total_marks_obtained numeric,
  add column if not exists total_marks_obtainable numeric,
  add column if not exists student_percentage numeric,
  add column if not exists maximum_attendance integer,
  add column if not exists times_present integer,
  add column if not exists times_absent integer,
  add column if not exists term_ending text,
  add column if not exists next_term_begins text,
  add column if not exists teacher_comment text,
  add column if not exists principal_comment text;

alter table public.report_cards
  alter column calculation_mode set default 'Manual';

do $$
begin
  if exists (
    select 1 from public.report_cards
    where report_type is null
      or calculation_mode is null
      or report_type not in ('Midterm', 'End-of-Term')
      or calculation_mode not in ('Manual', 'Automatic')
  ) then
    raise exception 'Existing report_cards report_type or calculation_mode values need review before enforcing the two-type contract.';
  end if;

  if exists (
    select 1 from public.report_cards
    where school_id is null
      or student_id is null
      or class_id is null
      or term_id is null
      or academic_year is null
      or term is null
      or term not in ('First', 'Second', 'Third')
  ) then
    raise exception 'Existing report cards have incomplete identity fields. Resolve those records before enforcing report identity.';
  end if;

  if exists (
    select 1
    from public.report_cards
    group by school_id, student_id, class_id, academic_year, term, report_type
    having count(*) > 1
  ) then
    raise exception 'Duplicate report cards exist for a school, pupil, class, year, term, and report type; reconcile them without deleting records before adding the unique index.';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_report_type_check'
  ) then
    alter table public.report_cards
      add constraint report_cards_report_type_check
      check (report_type in ('Midterm', 'End-of-Term'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_calculation_mode_check'
  ) then
    alter table public.report_cards
      add constraint report_cards_calculation_mode_check
      check (calculation_mode in ('Manual', 'Automatic'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.report_cards'::regclass
      and conname = 'report_cards_term_check'
  ) then
    alter table public.report_cards
      add constraint report_cards_term_check
      check (term in ('First', 'Second', 'Third'));
  end if;
end;
$$;

alter table public.report_cards
  alter column report_type set not null,
  alter column calculation_mode set not null;

create unique index if not exists uidx_report_cards_period_type
  on public.report_cards(school_id, student_id, class_id, academic_year, term, report_type);

create or replace function public.is_report_card_teacher_for(
  target_student_id uuid,
  target_class_id uuid,
  target_academic_year text,
  target_term text,
  target_report_type text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id and ur.is_active = true
    join public.roles role_record on role_record.id = ur.role_id
    join public.classes c
      on c.id = target_class_id
      and c.class_teacher_id = u.id
    join public.students s
      on s.id = target_student_id
      and s.class_id = c.id
    join public.results r
      on r.student_id = s.id
      and r.class_id = c.id
      and r.academic_year = target_academic_year
      and r.term = target_term
      and (
        (target_report_type = 'Midterm' and r.assessment_type = 'CA')
        or (target_report_type = 'End-of-Term' and r.assessment_type in ('Combined', 'Examination'))
      )
    where u.id = auth.uid()
      and u.status = 'Active'
      and lower(replace(role_record.name, ' ', '_')) = 'teacher'
  );
$$;

create or replace function public.is_parent_report_card_available(
  target_student_id uuid,
  target_class_id uuid,
  target_academic_year text,
  target_term text,
  target_report_type text
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_parent_linked_student(target_student_id)
    and exists (
      select 1
      from public.results r
      where r.student_id = target_student_id
        and r.class_id = target_class_id
        and r.academic_year = target_academic_year
        and r.term = target_term
        and r.status = 'Published'
        and (
          (target_report_type = 'Midterm' and r.assessment_type = 'CA')
          or (target_report_type = 'End-of-Term' and r.assessment_type in ('Combined', 'Examination'))
        )
    );
$$;

revoke all on function public.is_report_card_teacher_for(uuid, uuid, text, text, text) from public, anon;
revoke all on function public.is_parent_report_card_available(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.is_report_card_teacher_for(uuid, uuid, text, text, text) to authenticated;
grant execute on function public.is_parent_report_card_available(uuid, uuid, text, text, text) to authenticated;

revoke all on public.report_cards from public, anon, authenticated;
grant select, insert, update, delete on public.report_cards to authenticated;

drop policy if exists "Report cards administrators manage" on public.report_cards;
drop policy if exists "Report cards assigned teachers manage" on public.report_cards;
drop policy if exists "Report cards parents read published reports" on public.report_cards;

create policy "Report cards administrators manage"
  on public.report_cards for all to authenticated
  using (public.is_assignment_admin())
  with check (public.is_assignment_admin());

create policy "Report cards assigned teachers read"
  on public.report_cards for select to authenticated
  using (public.is_report_card_teacher_for(student_id, class_id, academic_year, term, report_type));

create policy "Report cards assigned teachers insert"
  on public.report_cards for insert to authenticated
  with check (public.is_report_card_teacher_for(student_id, class_id, academic_year, term, report_type));

create policy "Report cards assigned teachers update"
  on public.report_cards for update to authenticated
  using (public.is_report_card_teacher_for(student_id, class_id, academic_year, term, report_type))
  with check (public.is_report_card_teacher_for(student_id, class_id, academic_year, term, report_type));

create policy "Report cards parents read published reports"
  on public.report_cards for select to authenticated
  using (public.is_parent_report_card_available(student_id, class_id, academic_year, term, report_type));

create or replace function public.save_imported_report_card(
  target_school_id uuid,
  result_updates jsonb,
  result_inserts jsonb,
  report_details jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  result_update record;
  report_row record;
  current_school_id uuid;
  resolved_term_id uuid;
  matching_terms integer;
  affected_rows integer;
begin
  if coalesce(jsonb_typeof(result_updates), '') <> 'array'
    or coalesce(jsonb_typeof(result_inserts), '') <> 'array'
    or coalesce(jsonb_typeof(report_details), '') <> 'object'
  then
    raise exception 'Imported results and report details have an invalid request shape.';
  end if;

  select school_id into current_school_id
  from public.school_settings
  where school_id = target_school_id;
  if current_school_id is null then
    raise exception 'School settings are required before importing report cards.';
  end if;

  for result_update in
    select * from jsonb_to_recordset(result_updates) as row_data(
      id uuid,
      student_id uuid,
      class_id uuid,
      subject_id uuid,
      teacher_id uuid,
      class_name text,
      subject_name text,
      teacher_name text,
      academic_year text,
      term text,
      assessment_type text,
      calculation_mode text,
      continuous_assessment numeric,
      maximum_score numeric,
      examination numeric,
      total_score numeric,
      grade text,
      remark text
    )
  loop
    update public.results r
    set student_id = result_update.student_id,
        class_id = result_update.class_id,
        subject_id = result_update.subject_id,
        teacher_id = result_update.teacher_id,
        class_name = result_update.class_name,
        subject_name = result_update.subject_name,
        teacher_name = result_update.teacher_name,
        academic_year = result_update.academic_year,
        term = result_update.term,
        assessment_type = result_update.assessment_type,
        calculation_mode = result_update.calculation_mode,
        continuous_assessment = result_update.continuous_assessment,
        maximum_score = result_update.maximum_score,
        examination = result_update.examination,
        total_score = result_update.total_score,
        grade = result_update.grade,
        remark = result_update.remark,
        updated_at = now()
    where r.id = result_update.id;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'A selected result no longer exists. Reload the workbook and try again.';
    end if;
  end loop;

  insert into public.results (
    student_id, class_id, subject_id, teacher_id, class_name, subject_name,
    teacher_name, academic_year, term, assessment_type, calculation_mode,
    continuous_assessment, maximum_score, examination, total_score, grade,
    remark, status, created_by
  )
  select row_data.student_id, row_data.class_id, row_data.subject_id,
    row_data.teacher_id, row_data.class_name, row_data.subject_name,
    row_data.teacher_name, row_data.academic_year, row_data.term,
    row_data.assessment_type, row_data.calculation_mode,
    row_data.continuous_assessment, row_data.maximum_score, row_data.examination,
    row_data.total_score, row_data.grade, row_data.remark, 'Draft', auth.uid()
  from jsonb_to_recordset(result_inserts) as row_data(
    student_id uuid,
    class_id uuid,
    subject_id uuid,
    teacher_id uuid,
    class_name text,
    subject_name text,
    teacher_name text,
    academic_year text,
    term text,
    assessment_type text,
    calculation_mode text,
    continuous_assessment numeric,
    maximum_score numeric,
    examination numeric,
    total_score numeric,
    grade text,
    remark text
  );

  select * into report_row
  from jsonb_to_record(report_details) as row_data(
    student_id uuid,
    class_id uuid,
    academic_year text,
    term text,
    report_type text,
    calculation_mode text,
    class_teacher_name text,
    class_teacher_comment text,
    head_teacher_comment text,
    class_average numeric,
    total_marks_obtained numeric,
    total_marks_obtainable numeric,
    student_percentage numeric,
    maximum_attendance integer,
    times_present integer,
    times_absent integer,
    term_ending text,
    next_term_begins text
  );

  if report_row.report_type is null
    or report_row.report_type not in ('Midterm', 'End-of-Term')
  then
    raise exception 'The report type must be Midterm or End-of-Term.';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = report_row.student_id
      and s.class_id = report_row.class_id
  ) then
    raise exception 'The selected pupil must be assigned to the report-card class.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(result_updates || result_inserts) imported(row_data)
    left join public.classes c on c.id::text = imported.row_data ->> 'class_id'
    where imported.row_data ->> 'student_id' is distinct from report_row.student_id::text
      or imported.row_data ->> 'class_id' is distinct from report_row.class_id::text
      or imported.row_data ->> 'academic_year' is distinct from report_row.academic_year
      or imported.row_data ->> 'term' is distinct from report_row.term
      or c.id is null
      or imported.row_data ->> 'teacher_id' is distinct from c.class_teacher_id::text
      or (
        report_row.report_type = 'Midterm'
        and imported.row_data ->> 'assessment_type' is distinct from 'CA'
      )
      or (
        report_row.report_type = 'End-of-Term'
        and (
          imported.row_data ->> 'assessment_type' is null
          or imported.row_data ->> 'assessment_type' not in ('Combined', 'Examination')
        )
      )
  ) then
    raise exception 'Imported results must match the selected pupil, class, session, term, assigned teacher, and report type.';
  end if;

  select count(*) into matching_terms
  from public.terms t
  join public.academic_sessions s on s.id = t.academic_session_id
  where t.term_name = report_row.term || ' Term'
    and s.session_name = report_row.academic_year;
  if matching_terms <> 1 then
    raise exception 'The selected academic session and term must resolve to exactly one saved term.';
  end if;
  select t.id into resolved_term_id
  from public.terms t
  join public.academic_sessions s on s.id = t.academic_session_id
  where t.term_name = report_row.term || ' Term'
    and s.session_name = report_row.academic_year;

  insert into public.report_cards (
    school_id, student_id, class_id, term_id, academic_year, term, report_type,
    calculation_mode, class_teacher_name, class_teacher_comment,
    head_teacher_comment, class_average, total_marks_obtained,
    total_marks_obtainable, student_percentage, maximum_attendance,
    times_present, times_absent, term_ending, next_term_begins
  )
  values (
    current_school_id, report_row.student_id, report_row.class_id,
    resolved_term_id, report_row.academic_year, report_row.term,
    report_row.report_type, report_row.calculation_mode,
    report_row.class_teacher_name, report_row.class_teacher_comment,
    report_row.head_teacher_comment, report_row.class_average,
    report_row.total_marks_obtained, report_row.total_marks_obtainable,
    report_row.student_percentage, report_row.maximum_attendance,
    report_row.times_present, report_row.times_absent,
    report_row.term_ending, report_row.next_term_begins
  )
  on conflict (school_id, student_id, class_id, academic_year, term, report_type)
  do update set
    term_id = excluded.term_id,
    calculation_mode = excluded.calculation_mode,
    class_teacher_name = excluded.class_teacher_name,
    class_teacher_comment = excluded.class_teacher_comment,
    head_teacher_comment = excluded.head_teacher_comment,
    class_average = excluded.class_average,
    total_marks_obtained = excluded.total_marks_obtained,
    total_marks_obtainable = excluded.total_marks_obtainable,
    student_percentage = excluded.student_percentage,
    maximum_attendance = excluded.maximum_attendance,
    times_present = excluded.times_present,
    times_absent = excluded.times_absent,
    term_ending = excluded.term_ending,
    next_term_begins = excluded.next_term_begins,
    updated_at = now();
end;
$$;

revoke all on function public.save_imported_report_card(uuid, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_imported_report_card(uuid, jsonb, jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
