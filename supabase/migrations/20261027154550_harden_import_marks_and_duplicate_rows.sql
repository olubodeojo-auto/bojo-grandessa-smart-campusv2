-- Reject incomplete marks or duplicate result rows before completing an import.
-- The import save and this check run in one transaction, so any failure rolls back the save.
CREATE OR REPLACE FUNCTION public.mark_result_import_review_draft_status_v2(target_school_id uuid, target_workbook_key text, target_entry_key text, target_owner_id uuid, target_student_id uuid, target_class_id uuid, target_workflow_status text, target_result_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_id uuid := auth.uid();
  owner_to_update uuid := coalesce(target_owner_id, auth.uid());
  saved_payload jsonb;
  saved_class_id uuid;
  saved_student_id uuid;
  existing_workflow_status text;
  expected_item_count integer;
  result_count integer;
  distinct_subject_count integer;
  published_result_count integer;
  valid_status_count integer;
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

  select d.draft_payload, d.class_id, d.student_id, d.workflow_status
    into saved_payload, saved_class_id, saved_student_id, existing_workflow_status
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
    or jsonb_typeof(saved_payload->'items') <> 'array'
  then
    raise exception 'The saved workbook entry has incomplete period, subject or report-type metadata.';
  end if;
  if existing_workflow_status = 'published' and target_workflow_status = 'imported_draft' then
    raise exception 'A published pupil entry cannot be moved back to an imported draft.';
  end if;
  if saved_student_id is not null and saved_student_id is distinct from target_student_id then
    raise exception 'The saved workbook pupil does not match the result records being marked.';
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

  expected_item_count := jsonb_array_length(saved_payload->'items');
  if expected_item_count < 1
    or cardinality(target_result_ids) <> expected_item_count
    or cardinality(target_result_ids) <> (
      select count(distinct result_id)::integer
      from unnest(target_result_ids) as ids(result_id)
    )
  then
    raise exception 'Every pupil subject must be linked to one distinct saved result before this entry can be marked complete.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(saved_payload->'items') as source_items(item)
    where (case when jsonb_typeof(source_items.item->'invalidMarks') = 'array'
                     then jsonb_array_length(source_items.item->'invalidMarks') else 0 end) > 0
      or (
        jsonb_typeof(source_items.item->'scoreInputText') = 'object'
        and (
          (
            source_items.item->>'assessmentType' in ('CA', 'Combined')
            and nullif(trim(source_items.item->'scoreInputText'->>'continuousAssessment'), '') is not null
            and (source_items.item->'scoreInputText'->>'continuousAssessment') !~ '^-?[0-9]+([.][0-9]+)?$'
          )
          or (
            source_items.item->>'assessmentType' = 'CA'
            and nullif(trim(source_items.item->'scoreInputText'->>'maximumScore'), '') is not null
            and (source_items.item->'scoreInputText'->>'maximumScore') !~ '^[0-9]+([.][0-9]+)?$'
          )
          or (
            source_items.item->>'assessmentType' in ('Combined', 'Examination')
            and nullif(trim(source_items.item->'scoreInputText'->>'examination'), '') is not null
            and (source_items.item->'scoreInputText'->>'examination') !~ '^-?[0-9]+([.][0-9]+)?$'
          )
          or (
            source_items.item->>'assessmentType' in ('Combined', 'Examination')
            and nullif(trim(source_items.item->'scoreInputText'->>'totalScore'), '') is not null
            and (source_items.item->'scoreInputText'->>'totalScore') !~ '^-?[0-9]+([.][0-9]+)?$'
          )
        )
      )
      or coalesce(source_items.item->>'subjectId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or coalesce(source_items.item->>'classId', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      or not exists (
        select 1
        from public.results r
        where r.id = any(target_result_ids)
          and r.student_id = target_student_id
          and r.class_id = case
            when source_items.item->>'classId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (source_items.item->>'classId')::uuid
            else null
          end
          and r.subject_id = case
            when source_items.item->>'subjectId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then (source_items.item->>'subjectId')::uuid
            else null
          end
          and r.academic_year = coalesce(nullif(source_items.item->>'academicYear', ''), saved_payload->>'academicYear')
          and r.term = coalesce(nullif(source_items.item->>'term', ''), saved_payload->>'term')
          and r.assessment_type = case
            when saved_payload->>'reportKind' = 'Midterm / Continuous Assessment' then 'CA'
            when source_items.item->>'assessmentType' = 'Examination' then 'Examination'
            else 'Combined'
          end
          and r.status in ('Draft', 'Published')
      )
  ) then
    raise exception 'A saved result does not match one of this pupil’s selected subject rows, assessment period, class or report type.';
  end if;

  if exists (
    select 1
    from public.results chosen
    join public.results duplicate
      on duplicate.student_id = chosen.student_id
      and duplicate.class_id = chosen.class_id
      and duplicate.subject_id = chosen.subject_id
      and duplicate.academic_year = chosen.academic_year
      and duplicate.term = chosen.term
      and duplicate.assessment_type = chosen.assessment_type
      and duplicate.id <> chosen.id
    where chosen.id = any(target_result_ids)
      and chosen.student_id = target_student_id
      and chosen.class_id = target_class_id
  ) then
    raise exception 'More than one saved result exists for a pupil subject in this period. Resolve the duplicate result rows before completing this import.';
  end if;

  if exists (
    select 1
    from public.results r
    where r.id = any(target_result_ids)
      and (
        (r.assessment_type = 'CA' and (
          r.continuous_assessment is null
          or r.maximum_score is null
          or r.maximum_score <= 0
          or r.continuous_assessment < 0
          or r.continuous_assessment > r.maximum_score
        ))
        or (r.assessment_type = 'Combined' and (
          r.continuous_assessment is null
          or r.examination is null
          or r.total_score is null
          or r.continuous_assessment < 0 or r.continuous_assessment > 40
          or r.examination < 0 or r.examination > 60
          or r.total_score < 0 or r.total_score > 100
        ))
        or (r.assessment_type = 'Examination' and (
          r.examination is null
          or r.total_score is null
          or r.examination < 0 or r.examination > 100
          or r.total_score < 0 or r.total_score > 100
        ))
      )
  ) then
    raise exception 'The saved subject rows have missing or invalid marks. Correct the marks before completing this import.';
  end if;

  select
    count(*)::integer,
    count(distinct r.subject_id)::integer,
    count(*) filter (where r.status = 'Published')::integer,
    count(*) filter (where r.status in ('Draft', 'Published'))::integer
  into result_count, distinct_subject_count, published_result_count, valid_status_count
  from public.results r
  where r.id = any(target_result_ids)
    and r.student_id = target_student_id
    and r.class_id = target_class_id
    and r.academic_year = saved_payload->>'academicYear'
    and r.term = saved_payload->>'term'
    and r.subject_id is not null
    and r.assessment_type = case
      when saved_payload->>'reportKind' = 'Midterm / Continuous Assessment' then 'CA'
      else r.assessment_type
    end;

  if result_count <> cardinality(target_result_ids)
    or result_count <> expected_item_count
    or distinct_subject_count <> result_count
    or valid_status_count <> result_count
  then
    raise exception 'The saved pupil entry can only be marked after every linked subject result is verified.';
  end if;

  if target_workflow_status = 'published' and published_result_count <> result_count then
    raise exception 'A pupil entry can only be marked published after every linked subject result is Published.';
  end if;
  if target_workflow_status = 'imported_draft' and published_result_count >= result_count then
    raise exception 'An entry with no outstanding draft results should be marked published.';
  end if;

  update public.result_import_review_drafts d
  set workflow_status = target_workflow_status,
      imported_result_ids = target_result_ids,
      imported_at = coalesce(d.imported_at, now()),
      published_at = case when target_workflow_status = 'published' then coalesce(d.published_at, now()) else d.published_at end,
      updated_by = actor_id,
      updated_at = now()
  where d.school_id = target_school_id
    and d.created_by = owner_to_update
    and d.workbook_key = target_workbook_key
    and d.entry_key = target_entry_key;
end;
$function$;
revoke all on function public.mark_result_import_review_draft_status_v2(uuid,text,text,uuid,uuid,uuid,text,uuid[]) from public, anon;
grant execute on function public.mark_result_import_review_draft_status_v2(uuid,text,text,uuid,uuid,uuid,text,uuid[]) to authenticated;
notify pgrst, 'reload schema';
