-- Durable workflow tracking and reusable class-specific subject aliases.
-- Existing pupil marks and publication states are not altered.
alter table public.result_import_review_drafts
  add column if not exists workflow_status text,
  add column if not exists imported_result_ids uuid[],
  add column if not exists imported_at timestamptz,
  add column if not exists published_at timestamptz;

update public.result_import_review_drafts d
set workflow_status = d.draft_payload ->> 'workflowStatus',
    imported_result_ids = array(
      select value::uuid
      from jsonb_array_elements_text(d.draft_payload -> 'importedResultIds') as ids(value)
    ),
    imported_at = d.updated_at,
    published_at = case when d.draft_payload ->> 'workflowStatus' = 'published' then d.updated_at else null end
where d.workflow_status is null
  and d.draft_payload ->> 'workflowStatus' in ('imported_draft', 'published')
  and jsonb_typeof(d.draft_payload -> 'importedResultIds') = 'array'
  and jsonb_array_length(d.draft_payload -> 'importedResultIds') > 0
  and not exists (
    select 1
    from jsonb_array_elements_text(d.draft_payload -> 'importedResultIds') as ids(value)
    where ids.value !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'result_import_review_drafts_workflow_status_check'
      and conrelid = 'public.result_import_review_drafts'::regclass
  ) then
    alter table public.result_import_review_drafts
      add constraint result_import_review_drafts_workflow_status_check
      check (workflow_status is null or workflow_status in ('imported_draft', 'published'));
  end if;
end;
$$;

create index if not exists idx_result_import_review_drafts_school_status_updated
  on public.result_import_review_drafts (school_id, workflow_status, updated_at desc);

create table if not exists public.result_import_subject_mappings (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.school_settings(school_id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  source_subject_name text not null,
  source_subject_key text not null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint result_import_subject_mappings_class_source_key
    unique (school_id, class_id, source_subject_key),
  constraint result_import_subject_mappings_nonempty_source
    check (length(trim(source_subject_name)) > 0 and length(trim(source_subject_key)) > 0)
);
alter table public.result_import_subject_mappings enable row level security;
revoke all on public.result_import_subject_mappings from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_result_import_review_draft_v2(target_school_id uuid, target_workbook_key text, target_entry_key text, target_student_id uuid, target_class_id uuid, draft_payload jsonb, target_owner_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_id uuid := auth.uid();
  owner_to_write uuid := coalesce(target_owner_id, auth.uid());
  clean_payload jsonb;
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

  clean_payload := draft_payload
    - 'workflowStatus'
    - 'importedResultIds'
    - 'importedAt'
    - 'publishedAt'
    - 'importedResultCount'
    - 'publishedResultCount'
    - 'resultImportStudentId'
    - 'resultImportClassId';

  insert into public.result_import_review_drafts (
    school_id, created_by, updated_by, workbook_key, entry_key, student_id, class_id, draft_payload
  ) values (
    target_school_id, owner_to_write, actor_id, trim(target_workbook_key), trim(target_entry_key),
    target_student_id, target_class_id, clean_payload
  )
  on conflict (school_id, created_by, workbook_key, entry_key)
  do update set
    student_id = excluded.student_id,
    class_id = excluded.class_id,
    draft_payload = clean_payload,
    updated_by = actor_id,
    updated_at = now();
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_result_import_review_drafts_v2(target_school_id uuid, target_workbook_key text, target_owner_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(entry_key text, student_id uuid, class_id uuid, draft_payload jsonb, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  select d.entry_key, d.student_id, d.class_id,
    (
      (d.draft_payload
        - 'workflowStatus'
        - 'importedResultIds'
        - 'importedAt'
        - 'publishedAt'
        - 'importedResultCount'
        - 'publishedResultCount'
        - 'resultImportStudentId'
        - 'resultImportClassId')
      ||
      case when d.workflow_status is null then '{}'::jsonb
      else jsonb_build_object(
        'workflowStatus', d.workflow_status,
        'resultImportStudentId', d.student_id,
        'resultImportClassId', d.class_id,
        'importedResultIds', to_jsonb(d.imported_result_ids),
        'importedResultCount', cardinality(d.imported_result_ids),
        'publishedResultCount', (
          select count(*)::integer from public.results r
          where r.id = any(d.imported_result_ids) and r.status = 'Published'
        ),
        'importedAt', d.imported_at,
        'publishedAt', d.published_at
      ) end
    ) as draft_payload,
    d.updated_at
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
$function$;
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
CREATE OR REPLACE FUNCTION public.save_imported_report_card_and_track_v1(target_school_id uuid, result_updates jsonb, result_inserts jsonb, report_details jsonb, target_workbook_key text, target_entry_key text, target_owner_id uuid, target_existing_result_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_id uuid := auth.uid();
  report_row record;
  result_insert record;
  inserted_result_id uuid;
  result_ids uuid[] := '{}'::uuid[];
  total_result_count integer;
  published_result_count integer;
  workflow_status text;
begin
  if actor_id is null then
    raise exception 'Sign in before importing results.';
  end if;
  if nullif(trim(target_workbook_key), '') is null
    or nullif(trim(target_entry_key), '') is null
    or target_owner_id is null
    or coalesce(jsonb_typeof(result_updates), '') <> 'array'
    or coalesce(jsonb_typeof(result_inserts), '') <> 'array'
    or coalesce(jsonb_typeof(report_details), '') <> 'object'
  then
    raise exception 'The results run is incomplete. Reopen this pupil and try again.';
  end if;

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
    term_ending date,
    next_term_begins date
  );

  if report_row.student_id is null or report_row.class_id is null
    or nullif(trim(report_row.academic_year), '') is null
    or report_row.term not in ('First', 'Second', 'Third')
    or report_row.report_type not in ('Midterm', 'End-of-Term')
  then
    raise exception 'Choose the pupil, class, session, term and report type before saving results.';
  end if;

  -- Keep the existing, permission-checked save path for updates and report-card details.
  -- Insert rows here so their generated IDs are captured exactly for the tracking record.
  perform public.save_imported_report_card(
    target_school_id,
    result_updates,
    '[]'::jsonb,
    report_details
  );

  if exists (
    select 1
    from jsonb_array_elements(result_inserts) as insert_items(item)
    left join public.classes c on c.id = (insert_items.item->>'class_id')::uuid
    left join public.subjects s on s.id = (insert_items.item->>'subject_id')::uuid
    where (insert_items.item->>'student_id') is distinct from report_row.student_id::text
      or (insert_items.item->>'class_id') is distinct from report_row.class_id::text
      or (insert_items.item->>'academic_year') is distinct from report_row.academic_year
      or (insert_items.item->>'term') is distinct from report_row.term
      or c.id is null
      or s.id is null
      or (insert_items.item->>'teacher_id') is distinct from c.class_teacher_id::text
      or (
        report_row.report_type = 'Midterm'
        and (insert_items.item->>'assessment_type') is distinct from 'CA'
      )
      or (
        report_row.report_type = 'End-of-Term'
        and (insert_items.item->>'assessment_type') not in ('Combined', 'Examination')
      )
  ) then
    raise exception 'New subject rows must match this pupil, class teacher, session, term and report type.';
  end if;

  select coalesce(array_agg(updated_rows.id), '{}'::uuid[])
  into result_ids
  from jsonb_to_recordset(result_updates) as updated_rows(id uuid);

  result_ids := result_ids || coalesce(target_existing_result_ids, '{}'::uuid[]);

  for result_insert in
    select * from jsonb_to_recordset(result_inserts) as row_data(
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
    insert into public.results (
      student_id, class_id, subject_id, teacher_id, class_name, subject_name,
      teacher_name, academic_year, term, assessment_type, calculation_mode,
      continuous_assessment, maximum_score, examination, total_score, grade,
      remark, status, created_by
    )
    values (
      result_insert.student_id, result_insert.class_id, result_insert.subject_id,
      result_insert.teacher_id, result_insert.class_name, result_insert.subject_name,
      result_insert.teacher_name, result_insert.academic_year, result_insert.term,
      result_insert.assessment_type, result_insert.calculation_mode,
      result_insert.continuous_assessment, result_insert.maximum_score,
      result_insert.examination, result_insert.total_score, result_insert.grade,
      result_insert.remark, 'Draft', actor_id
    )
    returning id into inserted_result_id;

    result_ids := array_append(result_ids, inserted_result_id);
  end loop;

  if cardinality(result_ids) < 1
    or cardinality(result_ids) <> (
      select count(distinct result_id)::integer
      from unnest(result_ids) as ids(result_id)
    )
  then
    raise exception 'The same subject result was selected more than once. Refresh the pupil review before saving.';
  end if;

  select count(*)::integer,
         count(*) filter (where r.status = 'Published')::integer
  into total_result_count, published_result_count
  from public.results r
  where r.id = any(result_ids);

  if total_result_count <> cardinality(result_ids) then
    raise exception 'One or more subject results could not be read back after saving. No workflow status was changed.';
  end if;

  workflow_status := case
    when published_result_count = total_result_count then 'published'
    else 'imported_draft'
  end;

  -- This updates the private review row through its guarded security-definer RPC.
  -- If identity, subject coverage, status, or tracking fails, all preceding writes roll back.
  perform public.mark_result_import_review_draft_status_v2(
    target_school_id,
    target_workbook_key,
    target_entry_key,
    target_owner_id,
    report_row.student_id,
    report_row.class_id,
    workflow_status,
    result_ids
  );

  return jsonb_build_object(
    'result_ids', to_jsonb(result_ids),
    'workflow_status', workflow_status
  );
end;
$function$;
CREATE OR REPLACE FUNCTION public.get_result_import_subject_mappings_v1(target_school_id uuid)
 RETURNS TABLE(class_id uuid, source_subject_name text, source_subject_key text, subject_id uuid, subject_name text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Sign in before loading saved subject mappings.';
  end if;
  if target_school_id is null or not exists (
    select 1 from public.school_settings s where s.school_id = target_school_id
  ) then
    raise exception 'The selected school settings do not exist.';
  end if;
  if not public.is_assignment_admin() and not exists (
    select 1 from public.classes c
    where c.class_teacher_id = actor_id and c.status = 'Active'
  ) then
    raise exception 'Only an administrator or an assigned class teacher can load saved subject mappings.';
  end if;

  return query
  select m.class_id, m.source_subject_name, m.source_subject_key,
         m.subject_id, s.subject_name, m.updated_at
  from public.result_import_subject_mappings m
  join public.classes c on c.id = m.class_id
  join public.subjects s on s.id = m.subject_id
  where m.school_id = target_school_id
    and (
      public.is_assignment_admin()
      or c.class_teacher_id = actor_id
    )
  order by c.class_name, m.source_subject_key;
end;
$function$;
CREATE OR REPLACE FUNCTION public.save_result_import_subject_mapping_v1(target_school_id uuid, target_class_id uuid, target_source_subject_name text, target_subject_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  actor_id uuid := auth.uid();
  normalized_source_key text;
begin
  if actor_id is null then
    raise exception 'Sign in before saving a subject mapping.';
  end if;
  if target_school_id is null
    or target_class_id is null
    or target_subject_id is null
    or nullif(trim(target_source_subject_name), '') is null
  then
    raise exception 'Choose a class, enter the workbook subject label, and select the official subject.';
  end if;
  if not exists (
    select 1 from public.school_settings s where s.school_id = target_school_id
  ) then
    raise exception 'The selected school settings do not exist.';
  end if;
  if not exists (
    select 1 from public.classes c
    where c.id = target_class_id and c.status = 'Active'
  ) then
    raise exception 'The class is no longer active. Refresh the class list before saving this mapping.';
  end if;
  if not exists (
    select 1 from public.subjects s
    where s.id = target_subject_id and s.status = 'Active'
  ) then
    raise exception 'The selected subject is no longer active. Refresh the subject list before saving this mapping.';
  end if;
  if not public.is_assignment_admin() and not exists (
    select 1 from public.classes c
    where c.id = target_class_id and c.class_teacher_id = actor_id
  ) then
    raise exception 'Only an administrator or the assigned class teacher can save a mapping for this class.';
  end if;

  normalized_source_key := lower(regexp_replace(trim(target_source_subject_name), '[^a-zA-Z0-9]+', '', 'g'));
  if normalized_source_key = '' then
    raise exception 'The workbook subject label does not contain any letters or numbers.';
  end if;

  insert into public.result_import_subject_mappings (
    school_id, class_id, source_subject_name, source_subject_key, subject_id, created_by, updated_by
  )
  values (
    target_school_id, target_class_id, trim(target_source_subject_name),
    normalized_source_key, target_subject_id, actor_id, actor_id
  )
  on conflict (school_id, class_id, source_subject_key)
  do update set
    source_subject_name = excluded.source_subject_name,
    subject_id = excluded.subject_id,
    updated_by = actor_id,
    updated_at = now();
end;
$function$;

revoke all on function public.save_result_import_review_draft_v2(uuid,text,text,uuid,uuid,jsonb,uuid) from public, anon;
grant execute on function public.save_result_import_review_draft_v2(uuid,text,text,uuid,uuid,jsonb,uuid) to authenticated;
revoke all on function public.get_result_import_review_drafts_v2(uuid,text,uuid) from public, anon;
grant execute on function public.get_result_import_review_drafts_v2(uuid,text,uuid) to authenticated;
revoke all on function public.mark_result_import_review_draft_status_v2(uuid,text,text,uuid,uuid,uuid,text,uuid[]) from public, anon;
grant execute on function public.mark_result_import_review_draft_status_v2(uuid,text,text,uuid,uuid,uuid,text,uuid[]) to authenticated;
revoke all on function public.save_imported_report_card_and_track_v1(uuid,jsonb,jsonb,jsonb,text,text,uuid,uuid[]) from public, anon;
grant execute on function public.save_imported_report_card_and_track_v1(uuid,jsonb,jsonb,jsonb,text,text,uuid,uuid[]) to authenticated;
revoke all on function public.get_result_import_subject_mappings_v1(uuid) from public, anon;
grant execute on function public.get_result_import_subject_mappings_v1(uuid) to authenticated;
revoke all on function public.save_result_import_subject_mapping_v1(uuid,uuid,text,uuid) from public, anon;
grant execute on function public.save_result_import_subject_mapping_v1(uuid,uuid,text,uuid) to authenticated;

notify pgrst, 'reload schema';
