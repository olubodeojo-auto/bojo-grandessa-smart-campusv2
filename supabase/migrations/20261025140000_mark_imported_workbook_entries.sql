-- Mark reviewed workbook entries after the corresponding result records have been saved.
-- This preserves the source workbook for audit while preventing already-imported entries
-- from continuing to appear as work waiting to import.

create or replace function public.mark_result_import_review_draft_status_v2(
  target_school_id uuid,
  target_workbook_key text,
  target_entry_key text,
  target_owner_id uuid,
  target_student_id uuid,
  target_class_id uuid,
  target_workflow_status text,
  target_result_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_id uuid := auth.uid();
  owner_to_update uuid := coalesce(target_owner_id, auth.uid());
  saved_payload jsonb;
  saved_class_id uuid;
  result_count integer;
  distinct_subject_count integer;
  matching_status_count integer;
  published_result_count integer;
begin
  if actor_id is null then
    raise exception 'Sign in before updating an import review status.';
  end if;
  if target_school_id is null
    or nullif(trim(target_workbook_key), '') is null
    or nullif(trim(target_entry_key), '') is null
    or target_student_id is null
    or target_class_id is null
    or target_workflow_status not in ('published', 'imported_draft')
    or target_result_ids is null
    or cardinality(target_result_ids) < 1
  then
    raise exception 'The import review status request is incomplete.';
  end if;
  if not exists (select 1 from public.school_settings s where s.school_id = target_school_id) then
    raise exception 'The selected school settings do not exist.';
  end if;
  if owner_to_update is distinct from actor_id and not public.is_assignment_admin() then
    raise exception 'Only an administrator can update another staff member’s saved workbook status.';
  end if;

  select d.draft_payload, d.class_id
    into saved_payload, saved_class_id
  from public.result_import_review_drafts d
  where d.school_id = target_school_id
    and d.created_by = owner_to_update
    and d.workbook_key = target_workbook_key
    and d.entry_key = target_entry_key
  for update;

  if not found then
    raise exception 'The saved workbook pupil entry was not found for the specified owner.';
  end if;
  if saved_payload->>'academicYear' is null
    or saved_payload->>'term' is null
    or saved_payload->>'reportKind' is null
  then
    raise exception 'The saved workbook entry has incomplete period or report-type metadata.';
  end if;
  if saved_class_id is not null and saved_class_id is distinct from target_class_id then
    raise exception 'The saved workbook class does not match the result records being marked.';
  end if;
  if not exists (
    select 1 from public.students s
    where s.id = target_student_id and s.class_id = target_class_id
  ) then
    raise exception 'The selected pupil is no longer assigned to the result class.';
  end if;
  if not public.is_assignment_admin() and not exists (
    select 1 from public.classes c where c.id = target_class_id and c.class_teacher_id = actor_id
  ) then
    raise exception 'Only an administrator or the assigned class teacher can update this import review status.';
  end if;

  select
    count(*)::integer,
    count(distinct r.subject_id)::integer,
    count(*) filter (
      where r.status = case when target_workflow_status = 'published' then 'Published' else 'Draft' end
    )::integer,
    count(*) filter (where r.status = 'Published')::integer
  into result_count, distinct_subject_count, matching_status_count, published_result_count
  from public.results r
  where r.id = any(target_result_ids)
    and r.student_id = target_student_id
    and r.class_id = target_class_id
    and r.academic_year = saved_payload->>'academicYear'
    and r.term = saved_payload->>'term'
    and r.assessment_type = case
      when saved_payload->>'reportKind' = 'Midterm / Continuous Assessment' then 'CA'
      else r.assessment_type
    end;

  if result_count <> cardinality(target_result_ids)
    or result_count < 1
    or distinct_subject_count <> result_count
    or matching_status_count <> result_count
  then
    raise exception 'The saved pupil entry can only be marked after all result rows are verified in the requested status.';
  end if;

  update public.result_import_review_drafts d
  set draft_payload = d.draft_payload || jsonb_build_object(
        'workflowStatus', target_workflow_status,
        'resultImportStudentId', target_student_id::text,
        'resultImportClassId', target_class_id::text,
        'importedResultCount', result_count,
        'publishedResultCount', published_result_count,
        'importedAt', now(),
        'importedResultIds', to_jsonb(target_result_ids)
      ),
      updated_by = actor_id,
      updated_at = now()
  where d.school_id = target_school_id
    and d.created_by = owner_to_update
    and d.workbook_key = target_workbook_key
    and d.entry_key = target_entry_key;
end;
$$;

revoke all on function public.mark_result_import_review_draft_status_v2(uuid,text,text,uuid,uuid,uuid,text,uuid[]) from public, anon;
grant execute on function public.mark_result_import_review_draft_status_v2(uuid,text,text,uuid,uuid,uuid,text,uuid[]) to authenticated;

notify pgrst, 'reload schema';
