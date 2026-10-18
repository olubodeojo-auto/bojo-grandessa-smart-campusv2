do $$
begin
  if to_regclass('public.academic_sessions') is null
    or to_regclass('public.terms') is null
    or to_regprocedure('public.is_assignment_admin()') is null
  then
    raise exception 'Academic-session setup requires academic_sessions, terms, and public.is_assignment_admin().';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'session_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'start_date'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'end_date'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'is_current'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_sessions'
      and column_name = 'is_locked'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'academic_session_id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'term_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'start_date'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'end_date'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'terms'
      and column_name = 'is_current'
  ) then
    raise exception 'Academic-session setup found a schema mismatch. Expected the verified academic_sessions and terms columns.';
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1 from public.academic_sessions
    where is_current
    group by is_current
    having count(*) > 1
  ) or exists (
    select 1 from public.terms
    where is_current
    group by is_current
    having count(*) > 1
  ) then
    raise exception 'Multiple current academic sessions or terms exist. Resolve current flags before adding the single-current-period constraints.';
  end if;
end;
$$;

create unique index if not exists uidx_academic_sessions_single_current
  on public.academic_sessions (is_current) where is_current;
create unique index if not exists uidx_terms_single_current
  on public.terms (is_current) where is_current;


revoke all on public.academic_sessions, public.terms from public, anon, authenticated;
grant select, insert, update, delete on public.academic_sessions, public.terms to authenticated;

drop policy if exists "Academic sessions authenticated read" on public.academic_sessions;
drop policy if exists "Academic sessions administrators manage" on public.academic_sessions;
drop policy if exists "Terms authenticated read" on public.terms;
drop policy if exists "Terms administrators manage" on public.terms;

create policy "Academic sessions authenticated read"
  on public.academic_sessions for select to authenticated
  using (true);

create policy "Academic sessions administrators manage"
  on public.academic_sessions for all to authenticated
  using (public.is_assignment_admin())
  with check (public.is_assignment_admin());

create policy "Terms authenticated read"
  on public.terms for select to authenticated
  using (true);

create policy "Terms administrators manage"
  on public.terms for all to authenticated
  using (public.is_assignment_admin())
  with check (public.is_assignment_admin());

create or replace function public.save_academic_session_setup(
  target_session_id uuid,
  target_session_name text,
  target_session_start_date date,
  target_session_end_date date,
  target_is_current boolean,
  target_terms jsonb,
  target_current_term text
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  saved_session_id uuid;
  old_session_name text;
  session_was_current boolean := false;
  term_record record;
  previous_term_end date;
begin
  if not public.is_assignment_admin() then
    raise exception 'Only an administrator can create or update academic sessions and terms.';
  end if;

  if nullif(trim(target_session_name), '') is null
    or target_session_start_date is null
    or target_session_end_date is null
    or target_session_end_date < target_session_start_date
  then
    raise exception 'Enter a session name and valid session start and end dates.';
  end if;

  if jsonb_typeof(target_terms) <> 'array'
    or jsonb_array_length(target_terms) <> 3
  then
    raise exception 'Enter exactly First, Second, and Third term dates.';
  end if;

  if (
    select count(distinct case term_name
      when 'First Term' then 'First'
      when 'Second Term' then 'Second'
      when 'Third Term' then 'Third'
      else term_name
    end)
    from jsonb_to_recordset(target_terms) as terms(term_name text)
    where case term_name
      when 'First Term' then 'First'
      when 'Second Term' then 'Second'
      when 'Third Term' then 'Third'
      else term_name
    end in ('First', 'Second', 'Third')
  ) <> 3 then
    raise exception 'Each of First, Second, and Third terms must be entered exactly once.';
  end if;

  previous_term_end := target_session_start_date - 1;
  for term_record in
    select case term_name
        when 'First Term' then 'First'
        when 'Second Term' then 'Second'
        when 'Third Term' then 'Third'
        else term_name
      end as term_name,
      start_date, end_date
    from jsonb_to_recordset(target_terms) as terms(
      term_name text,
      start_date date,
      end_date date
    )
    order by case
      when term_name in ('First', 'First Term') then 1
      when term_name in ('Second', 'Second Term') then 2
      else 3
    end
  loop
    if term_record.start_date is null
      or term_record.end_date is null
      or term_record.end_date < term_record.start_date
      or term_record.start_date < target_session_start_date
      or term_record.end_date > target_session_end_date
      or term_record.start_date <= previous_term_end
    then
      raise exception 'Term dates must be valid, non-overlapping, in First/Second/Third order, and within the session dates.';
    end if;
    previous_term_end := term_record.end_date;
  end loop;

  if target_current_term is not null
    and target_current_term not in ('First', 'Second', 'Third')
  then
    raise exception 'The current term must be First, Second, Third, or unset.';
  end if;
  if target_current_term is not null and not target_is_current then
    raise exception 'A current term can only be selected for the current academic session.';
  end if;

  if target_session_id is null then
    if exists (
      select 1 from public.academic_sessions
      where session_name = trim(target_session_name)
    ) then
      raise exception 'An academic session with this name already exists. Select it to update its dates.';
    end if;
    insert into public.academic_sessions (
      session_name, start_date, end_date, is_current, is_locked
    )
    values (
      trim(target_session_name), target_session_start_date, target_session_end_date,
      false, false
    )
    returning id into saved_session_id;
  else
    select session_name, is_current into old_session_name, session_was_current
    from public.academic_sessions
    where id = target_session_id
    for update;
    if not found then
      raise exception 'The selected academic session no longer exists. Reload the session list.';
    end if;
    if exists (
      select 1 from public.academic_sessions
      where session_name = trim(target_session_name)
        and id <> target_session_id
    ) then
      raise exception 'Another academic session already uses this name.';
    end if;
    update public.academic_sessions
    set session_name = trim(target_session_name),
        start_date = target_session_start_date,
        end_date = target_session_end_date,
        is_current = false
    where id = target_session_id
    returning id into saved_session_id;

    if old_session_name is distinct from trim(target_session_name) then
      update public.results
      set academic_year = trim(target_session_name)
      where academic_year = old_session_name;

      if to_regclass('public.report_cards') is not null then
        execute
          'update public.report_cards set academic_year = $1 where academic_year = $2'
          using trim(target_session_name), old_session_name;
      end if;
    end if;
  end if;

  if target_is_current then
    update public.academic_sessions set is_current = false where id <> saved_session_id;
    update public.academic_sessions set is_current = true where id = saved_session_id;
    update public.terms set is_current = false;
  elsif session_was_current then
    update public.terms set is_current = false;
  else
    update public.terms set is_current = false
    where academic_session_id = saved_session_id;
  end if;

  insert into public.terms (
    academic_session_id, term_name, start_date, end_date, is_current
  )
  select saved_session_id,
    case term_name
      when 'First' then 'First Term'
      when 'Second' then 'Second Term'
      when 'Third' then 'Third Term'
      else term_name
    end,
    start_date,
    end_date,
    coalesce(target_is_current and case term_name
      when 'First Term' then 'First'
      when 'Second Term' then 'Second'
      when 'Third Term' then 'Third'
      else term_name
    end = target_current_term, false)
  from jsonb_to_recordset(target_terms) as terms(
    term_name text,
    start_date date,
    end_date date
  )
  on conflict (academic_session_id, term_name)
  do update set
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    is_current = excluded.is_current;

  return saved_session_id;
exception
  when invalid_datetime_format or datetime_field_overflow then
    raise exception 'Academic session and term dates must be valid calendar dates.';
end;
$$;

revoke all on function public.save_academic_session_setup(uuid, text, date, date, boolean, jsonb, text) from public, anon;
grant execute on function public.save_academic_session_setup(uuid, text, date, date, boolean, jsonb, text) to authenticated;
