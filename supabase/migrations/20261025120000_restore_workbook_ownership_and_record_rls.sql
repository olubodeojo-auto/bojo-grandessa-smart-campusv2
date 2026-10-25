-- Restore a clear owner-aware saved-workbook workflow and enforce existing row-access rules.
-- No result marks are changed and no notifications are sent by this migration.

alter table public.result_import_review_drafts
  add column if not exists updated_by uuid;

create or replace function public.get_result_import_review_workbooks_v2(
  target_school_id uuid
)
returns table (
  workbook_key text,
  owner_id uuid,
  owner_name text,
  entry_count integer,
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
    raise exception 'Sign in before listing saved import review workbooks.';
  end if;
  if target_school_id is null or not exists (
    select 1 from public.school_settings s where s.school_id = target_school_id
  ) then
    raise exception 'The selected school settings do not exist.';
  end if;
  if not public.is_assignment_admin()
    and not exists (
      select 1
      from public.result_import_review_drafts d
      join public.classes c on c.id = d.class_id
      where d.school_id = target_school_id
        and d.created_by = actor_id
        and c.class_teacher_id = actor_id
    )
  then
    raise exception 'Only an administrator or an assigned class teacher with saved pupil reviews can list import workbooks.';
  end if;

  return query
  select d.workbook_key,
         d.created_by,
         coalesce(nullif(trim(concat_ws(' ', u.first_name, u.last_name)), ''), 'School staff')::text,
         count(*)::integer,
         max(d.updated_at)
  from public.result_import_review_drafts d
  left join public.users u on u.id = d.created_by
  where d.school_id = target_school_id
    and (
      public.is_assignment_admin()
      or (
        d.created_by = actor_id
        and exists (
          select 1 from public.classes c
          where c.id = d.class_id and c.class_teacher_id = actor_id
        )
      )
    )
  group by d.workbook_key, d.created_by, u.first_name, u.last_name
  order by max(d.updated_at) desc;
end;
$$;

revoke all on function public.get_result_import_review_workbooks_v2(uuid) from public, anon;
grant execute on function public.get_result_import_review_workbooks_v2(uuid) to authenticated;

create or replace function public.get_result_import_review_drafts_v2(
  target_school_id uuid,
  target_workbook_key text,
  target_owner_id uuid default null
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
  owner_to_read uuid := coalesce(target_owner_id, auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in before loading import review progress.';
  end if;
  if target_workbook_key is null or length(trim(target_workbook_key)) = 0 then
    raise exception 'Choose a saved workbook to resume.';
  end if;
  if not exists (select 1 from public.school_settings s where s.school_id = target_school_id) then
    raise exception 'The selected school settings do not exist.';
  end if;
  if owner_to_read is distinct from actor_id and not public.is_assignment_admin() then
    raise exception 'Only an administrator can resume another staff member’s saved workbook.';
  end if;

  return query
  select d.entry_key, d.student_id, d.class_id, d.draft_payload, d.updated_at
  from public.result_import_review_drafts d
  where d.school_id = target_school_id
    and d.created_by = owner_to_read
    and d.workbook_key = target_workbook_key
    and (
      public.is_assignment_admin()
      or exists (
        select 1 from public.classes c
        where c.id = d.class_id and c.class_teacher_id = actor_id
      )
    )
  order by d.updated_at desc, d.entry_key;
end;
$$;

revoke all on function public.get_result_import_review_drafts_v2(uuid, text, uuid) from public, anon;
grant execute on function public.get_result_import_review_drafts_v2(uuid, text, uuid) to authenticated;

create or replace function public.save_result_import_review_draft_v2(
  target_school_id uuid,
  target_workbook_key text,
  target_entry_key text,
  target_student_id uuid,
  target_class_id uuid,
  draft_payload jsonb,
  target_owner_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  owner_to_write uuid := coalesce(target_owner_id, auth.uid());
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
  if not exists (select 1 from public.school_settings where school_id = target_school_id) then
    raise exception 'The selected school settings do not exist.';
  end if;
  if owner_to_write is distinct from actor_id and not public.is_assignment_admin() then
    raise exception 'Only an administrator can update another staff member’s saved workbook.';
  end if;
  if not public.is_assignment_admin() and not exists (
    select 1 from public.classes c
    where c.id = target_class_id and c.class_teacher_id = actor_id
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
  if owner_to_write is null then
    raise exception 'The saved workbook owner could not be resolved.';
  end if;

  insert into public.result_import_review_drafts (
    school_id, created_by, updated_by, workbook_key, entry_key, student_id, class_id, draft_payload
  ) values (
    target_school_id, owner_to_write, actor_id, trim(target_workbook_key), trim(target_entry_key),
    target_student_id, target_class_id, draft_payload
  )
  on conflict (school_id, created_by, workbook_key, entry_key)
  do update set
    student_id = excluded.student_id,
    class_id = excluded.class_id,
    draft_payload = excluded.draft_payload,
    updated_by = actor_id,
    updated_at = now();
end;
$$;

revoke all on function public.save_result_import_review_draft_v2(uuid, text, text, uuid, uuid, jsonb, uuid) from public, anon;
grant execute on function public.save_result_import_review_draft_v2(uuid, text, text, uuid, uuid, jsonb, uuid) to authenticated;

create or replace function public.delete_result_import_review_draft_v2(
  target_school_id uuid,
  target_workbook_key text,
  target_entry_key text,
  target_owner_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  owner_to_delete uuid := coalesce(target_owner_id, auth.uid());
begin
  if actor_id is null then
    raise exception 'Sign in before removing import review progress.';
  end if;
  if owner_to_delete is distinct from actor_id and not public.is_assignment_admin() then
    raise exception 'Only an administrator can remove another staff member’s saved workbook entry.';
  end if;
  if not exists (select 1 from public.school_settings where school_id = target_school_id) then
    raise exception 'The selected school settings do not exist.';
  end if;

  delete from public.result_import_review_drafts
  where school_id = target_school_id
    and created_by = owner_to_delete
    and workbook_key = target_workbook_key
    and entry_key = target_entry_key;
end;
$$;

revoke all on function public.delete_result_import_review_draft_v2(uuid, text, text, uuid) from public, anon;
grant execute on function public.delete_result_import_review_draft_v2(uuid, text, text, uuid) to authenticated;

-- The report-card authorization policies already exist and become effective once RLS is enabled.
alter table public.report_cards enable row level security;

-- Contact records are private school records; access is limited to authenticated staff.
revoke all on public.contacts from public, anon, authenticated;
grant select, insert, update on public.contacts to authenticated;
alter table public.contacts enable row level security;
drop policy if exists "Contacts staff manage" on public.contacts;
drop policy if exists "Contacts Full Access" on public.contacts;
drop policy if exists "Contacts staff access" on public.contacts;
create policy "Contacts staff manage"
on public.contacts
for all
to authenticated
using (public.is_active_staff_user())
with check (public.is_active_staff_user());

notify pgrst, 'reload schema';
