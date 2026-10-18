do $$
begin
  if to_regclass('public.school_settings') is null
    or to_regclass('public.students') is null
    or to_regclass('public.classes') is null
    or to_regprocedure('public.is_assignment_admin()') is null
  then
    raise exception 'Import review drafts require school settings, students, classes, and the existing administrator authorization helper.';
  end if;
end;
$$;

create table if not exists public.result_import_review_drafts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school_settings(school_id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  workbook_key text not null,
  entry_key text not null,
  student_id uuid references public.students(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  draft_payload jsonb not null check (jsonb_typeof(draft_payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint result_import_review_drafts_owner_workbook_entry_key
    unique (school_id, created_by, workbook_key, entry_key)
);

revoke all on public.result_import_review_drafts from public, anon, authenticated;

create or replace function public.save_result_import_review_draft(
  target_school_id uuid,
  target_workbook_key text,
  target_entry_key text,
  target_student_id uuid,
  target_class_id uuid,
  draft_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Sign in before saving import review progress.';
  end if;
  if target_workbook_key is null or length(trim(target_workbook_key)) = 0
    or target_entry_key is null or length(trim(target_entry_key)) = 0
    or coalesce(jsonb_typeof(draft_payload), '') <> 'object'
  then
    raise exception 'The import review draft is incomplete.';
  end if;
  if not exists (
    select 1 from public.school_settings
    where school_id = target_school_id
  ) then
    raise exception 'The selected school settings do not exist.';
  end if;
  if not public.is_assignment_admin() and not exists (
    select 1 from public.classes c
    where c.id = target_class_id
      and c.class_teacher_id = actor_id
  ) then
    raise exception 'Only an administrator or the assigned class teacher can save this pupil review.';
  end if;
  if target_student_id is not null and not exists (
    select 1 from public.students s
    where s.id = target_student_id
      and (target_class_id is null or s.class_id = target_class_id)
  ) then
    raise exception 'The selected student does not belong to the selected class.';
  end if;

  insert into public.result_import_review_drafts (
    school_id, created_by, workbook_key, entry_key, student_id, class_id, draft_payload
  )
  values (
    target_school_id, actor_id, trim(target_workbook_key), trim(target_entry_key),
    target_student_id, target_class_id, draft_payload
  )
  on conflict (school_id, created_by, workbook_key, entry_key)
  do update set
    student_id = excluded.student_id,
    class_id = excluded.class_id,
    draft_payload = excluded.draft_payload,
    updated_at = now();
end;
$$;

create or replace function public.get_result_import_review_drafts(
  target_school_id uuid,
  target_workbook_key text
)
returns table (
  entry_key text,
  student_id uuid,
  class_id uuid,
  draft_payload jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Sign in before loading import review progress.';
  end if;
  if not exists (
    select 1 from public.school_settings
    where school_id = target_school_id
  ) then
    raise exception 'The selected school settings do not exist.';
  end if;

  return query
  select d.entry_key, d.student_id, d.class_id, d.draft_payload, d.updated_at
  from public.result_import_review_drafts d
  where d.school_id = target_school_id
    and d.created_by = actor_id
    and d.workbook_key = target_workbook_key;
end;
$$;

create or replace function public.delete_result_import_review_draft(
  target_school_id uuid,
  target_workbook_key text,
  target_entry_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Sign in before removing import review progress.';
  end if;

  delete from public.result_import_review_drafts
  where school_id = target_school_id
    and created_by = actor_id
    and workbook_key = target_workbook_key
    and entry_key = target_entry_key;
end;
$$;

revoke all on function public.save_result_import_review_draft(uuid, text, text, uuid, uuid, jsonb) from public, anon;
revoke all on function public.get_result_import_review_drafts(uuid, text) from public, anon;
revoke all on function public.delete_result_import_review_draft(uuid, text, text) from public, anon;
grant execute on function public.save_result_import_review_draft(uuid, text, text, uuid, uuid, jsonb) to authenticated;
grant execute on function public.get_result_import_review_drafts(uuid, text) to authenticated;
grant execute on function public.delete_result_import_review_draft(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
