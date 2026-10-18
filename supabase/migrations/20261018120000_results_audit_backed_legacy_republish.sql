create or replace function public.has_verified_result_unpublish_history(
  target_result_id uuid,
  target_snapshot jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_assignment_admin() then
    return false;
  end if;
  if coalesce(jsonb_typeof(target_snapshot), '') <> 'array' then
    return false;
  end if;
  if jsonb_array_length(target_snapshot) not in (4, 5) then
    return false;
  end if;

  return exists (
    select 1
    from public.result_change_log audit
    where audit.result_id = target_result_id
      and audit.action = 'UPDATE'
      and audit.old_record ->> 'id' = target_result_id::text
      and audit.new_record ->> 'id' = target_result_id::text
      and audit.old_record ->> 'status' = 'Published'
      and audit.new_record ->> 'status' = 'Returned'
      and audit.new_record -> 'returned_assessment_snapshot' = target_snapshot
      and case
        when jsonb_array_length(target_snapshot) = 4 then
          target_snapshot = jsonb_build_array(
            audit.old_record -> 'assessment_type',
            audit.old_record -> 'continuous_assessment',
            audit.old_record -> 'examination',
            audit.old_record -> 'total_score'
          )
        else
          target_snapshot = jsonb_build_array(
            audit.old_record -> 'assessment_type',
            audit.old_record -> 'continuous_assessment',
            audit.old_record -> 'examination',
            audit.old_record -> 'total_score',
            audit.old_record -> 'maximum_score'
          )
      end
  );
end;
$$;

revoke all on function public.has_verified_result_unpublish_history(uuid, jsonb) from public, anon, authenticated;

create or replace function public.prevent_result_lifecycle_bypass()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin boolean := public.is_assignment_admin();
  action_name text := coalesce(current_setting('app.result_action', true), '');
  result_changed boolean;
begin
  if tg_op = 'DELETE' then
    if not is_admin then
      raise exception 'Only an administrator can permanently delete results.';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'Draft' then
      raise exception 'New result records must start as drafts.';
    end if;
    if new.class_id is null or new.subject_id is null then
      raise exception 'New results require resolved class and subject records.';
    end if;
    if new.created_by is distinct from auth.uid() then
      raise exception 'The result creator must be the signed-in user.';
    end if;
    if new.returned_assessment_snapshot is not null then
      raise exception 'Returned assessment evidence is managed by the lifecycle trigger.';
    end if;
    if new.submitted_by is not null or new.submitted_by_name is not null or new.submitted_at is not null
      or new.reviewed_by is not null or new.reviewed_at is not null
      or new.published_by is not null or new.published_at is not null
    then
      raise exception 'New result lifecycle metadata is set only by authorised workflow actions.';
    end if;
    if new.assessment_type = 'CA' and new.examination is not null then
      raise exception 'CA-only results cannot contain an examination score.';
    end if;
    if new.assessment_type = 'Examination' and new.continuous_assessment is not null then
      raise exception 'Examination-only results cannot contain a CA score.';
    end if;
    if new.assessment_type = 'CA'
      and (new.total_score is not null or new.grade is not null or new.remark is not null)
    then
      raise exception 'CA-only results cannot contain final totals, grades, or remarks.';
    end if;
    if new.maximum_score is not null and (new.assessment_type <> 'CA' or new.maximum_score <= 0) then
      raise exception 'A maximum score must be positive and is only valid for Midterm results.';
    end if;
    if new.continuous_assessment < 0
      or (new.assessment_type = 'CA' and new.maximum_score is not null and new.continuous_assessment > new.maximum_score)
      or (new.assessment_type = 'Combined' and new.continuous_assessment > 40)
      or (new.assessment_type = 'Combined' and new.examination > 60)
      or (new.assessment_type = 'Examination' and new.examination > 100)
      or new.examination < 0
      or new.total_score < 0
      or new.total_score > 100
    then
      raise exception 'Assessment marks are outside their permitted ranges.';
    end if;
    if not is_admin and not public.is_result_teacher_for(new.student_id, new.class_id, new.subject_id) then
      raise exception 'Teachers may create results only for their assigned class.';
    end if;
    return new;
  end if;

  result_changed := row(
    new.student_id, new.class_id, new.subject_id, new.class_name, new.subject_name,
    new.teacher_id, new.teacher_name, new.academic_year, new.term,
    new.assessment_type, new.continuous_assessment, new.examination,
    new.total_score, new.grade, new.remark, new.maximum_score
  ) is distinct from row(
    old.student_id, old.class_id, old.subject_id, old.class_name, old.subject_name,
    old.teacher_id, old.teacher_name, old.academic_year, old.term,
    old.assessment_type, old.continuous_assessment, old.examination,
    old.total_score, old.grade, old.remark, old.maximum_score
  );
  if result_changed and (
    new.maximum_score is not null and (new.assessment_type <> 'CA' or new.maximum_score <= 0)
    or new.continuous_assessment < 0
    or (new.assessment_type = 'CA' and new.maximum_score is not null and new.continuous_assessment > new.maximum_score)
    or (new.assessment_type = 'Combined' and new.continuous_assessment > 40)
    or (new.assessment_type = 'Combined' and new.examination > 60)
    or (new.assessment_type = 'Examination' and new.examination > 100)
    or new.examination < 0
    or new.total_score < 0
    or new.total_score > 100
  ) then
    raise exception 'Assessment marks are outside their permitted ranges.';
  end if;
  if new.assessment_type = 'CA' and new.examination is not null then
    raise exception 'CA-only results cannot contain an examination score.';
  end if;
  if new.assessment_type = 'CA'
    and (new.total_score is not null or new.grade is not null or new.remark is not null)
  then
    raise exception 'CA-only results cannot contain final totals, grades, or remarks.';
  end if;
  if new.assessment_type = 'Examination' and new.continuous_assessment is not null then
    raise exception 'Examination-only results cannot contain a CA score.';
  end if;
  if new.created_by is distinct from old.created_by then
    raise exception 'A result creator cannot be changed after insertion.';
  end if;
  if new.submitted_by is distinct from old.submitted_by
    or new.submitted_by_name is distinct from old.submitted_by_name
    or new.submitted_at is distinct from old.submitted_at
  then
    if action_name is distinct from 'submit'
      or is_admin
      or new.submitted_by is distinct from auth.uid()
      or nullif(trim(new.submitted_by_name), '') is null
      or new.submitted_at is null
    then
      raise exception 'Submission metadata can only be set by the assigned teacher submit action.';
    end if;
  end if;
  if new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
  then
    if action_name not in ('return', 'unpublish')
      or not is_admin
      or new.reviewed_by is distinct from auth.uid()
      or new.reviewed_at is null
    then
      raise exception 'Review metadata can only be set by an authorised return or unpublish workflow.';
    end if;
  end if;
  if new.published_by is distinct from old.published_by
    or new.published_at is distinct from old.published_at
  then
    if action_name is distinct from 'publish'
      or not is_admin
      or new.published_by is distinct from auth.uid()
      or new.published_at is null
    then
      raise exception 'Publication metadata can only be set by the authorised publish workflow.';
    end if;
  end if;
  if new.review_reason is distinct from old.review_reason
    and action_name not in ('publish', 'return', 'unpublish', 'submit')
  then
    raise exception 'Correction reasons can only be changed by publish or unpublish actions.';
  end if;

  if not is_admin and (
    old.status not in ('Draft', 'Returned')
    or (old.status = 'Returned' and old.published_at is not null)
    or (new.status is distinct from old.status and not (
      action_name = 'submit'
      and new.status = 'Submitted'
      and old.published_at is null
    ))
    or new.created_by is distinct from old.created_by
    or not public.is_result_teacher_for(new.student_id, new.class_id, new.subject_id)
    or row(
      new.student_id, new.class_id, new.subject_id, new.teacher_id, new.class_name, new.subject_name,
      new.teacher_name, new.academic_year, new.term
    ) is distinct from row(
      old.student_id, old.class_id, old.subject_id, old.teacher_id, old.class_name, old.subject_name,
      old.teacher_name, old.academic_year, old.term
    )
  ) then
    raise exception 'Teachers may edit only their own assigned draft result marks.';
  end if;

  if new.status is distinct from old.status then
    if new.status = 'Submitted' then
      if action_name is distinct from 'submit'
        or is_admin
        or old.status not in ('Draft', 'Returned')
        or old.published_at is not null
        or new.submitted_by is distinct from auth.uid()
        or new.submitted_at is null
        or result_changed
      then
        raise exception 'Only the assigned teacher can submit an unchanged draft or returned result.';
      end if;
    elsif new.status = 'Returned' then
      if action_name = 'return' then
        if not is_admin
          or old.status is distinct from 'Submitted'
          or char_length(coalesce(trim(new.review_reason), '')) > 250
          or result_changed
        then
          raise exception 'Only an administrator can return a submitted result with an optional message of up to 250 characters.';
        end if;
      elsif action_name = 'unpublish' then
        if not is_admin
          or old.status is distinct from 'Published'
          or char_length(coalesce(trim(new.review_reason), '')) > 250
          or result_changed
        then
          raise exception 'Only an administrator can unpublish a result with an optional internal note of up to 250 characters.';
        end if;
      else
        raise exception 'Unsupported result return transition.';
      end if;
    elsif new.status = 'Published' then
      if action_name is distinct from 'publish'
        or not is_admin
        or new.published_by is distinct from auth.uid()
        or new.published_at is null
      then
        raise exception 'Only an authorised administrator can publish results.';
      end if;
      if old.status not in ('Draft', 'Submitted')
        and not (
          old.status is not distinct from 'Returned'
          and (old.published_at is not null
            or public.has_verified_result_unpublish_history(old.id, old.returned_assessment_snapshot))
          and old.returned_assessment_snapshot is not null
          and (
            (
              old.published_at is null
              and public.has_verified_result_unpublish_history(old.id, old.returned_assessment_snapshot)
            )
            or case
              when jsonb_typeof(old.returned_assessment_snapshot) is distinct from 'array' then false
              when jsonb_array_length(old.returned_assessment_snapshot) = 4
              then jsonb_build_array(
                new.assessment_type, new.continuous_assessment, new.examination, new.total_score
              ) is distinct from old.returned_assessment_snapshot
              when jsonb_array_length(old.returned_assessment_snapshot) = 5
              then jsonb_build_array(
                new.assessment_type, new.continuous_assessment, new.examination, new.total_score, new.maximum_score
              ) is distinct from old.returned_assessment_snapshot
              else false
            end
          )
        )
      then
        raise exception 'A returned result must have verified publication history and a valid snapshot; assessment values must be corrected unless verified legacy history confirms a missing publication timestamp.';
      end if;
      if new.class_id is null or new.subject_id is null then
        raise exception 'Resolve the result class and subject before publishing.';
      end if;
    else
      raise exception 'Unsupported results status transition.';
    end if;
  elsif action_name in ('publish', 'return', 'unpublish', 'submit') then
    raise exception 'The requested result action must make a valid status transition.';
  end if;

  if new.status = 'Returned' and old.status = 'Published' then
    new.returned_assessment_snapshot := jsonb_build_array(
      old.assessment_type, old.continuous_assessment, old.examination, old.total_score, old.maximum_score
    );
  elsif old.status = 'Returned' and new.status = 'Published' then
    new.returned_assessment_snapshot := null;
  elsif new.returned_assessment_snapshot is distinct from old.returned_assessment_snapshot then
    raise exception 'Returned assessment evidence can only be changed by a valid publish or unpublish transition.';
  end if;

  return new;
end;
$$;

create or replace function public.review_result(target_result_id uuid, decision text, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.results%rowtype;
begin
  if not public.is_assignment_admin() then
    raise exception 'Only an authorised administrator can review, publish, or unpublish results.';
  end if;

  select * into target from public.results where id = target_result_id for update;
  if not found then
    raise exception 'Result not found.';
  end if;

  if decision = 'publish' and target.status = 'Published' then
    return;
  elsif decision = 'return' and target.status = 'Returned'
    and target.published_at is null
    and target.review_reason = nullif(trim(reason), '')
  then
    return;
  elsif decision = 'unpublish' and target.status = 'Returned'
    and (target.published_at is not null
      or public.has_verified_result_unpublish_history(target.id, target.returned_assessment_snapshot))
    and target.review_reason = nullif(trim(reason), '')
  then
    return;
  end if;

  if decision = 'publish' then
    if target.status is distinct from 'Draft'
      and target.status is distinct from 'Submitted'
      and not (
        target.status is not distinct from 'Returned'
        and (target.published_at is not null
          or public.has_verified_result_unpublish_history(target.id, target.returned_assessment_snapshot))
        and target.returned_assessment_snapshot is not null
        and (
          (
            target.published_at is null
            and public.has_verified_result_unpublish_history(target.id, target.returned_assessment_snapshot)
          )
          or case
            when jsonb_typeof(target.returned_assessment_snapshot) is distinct from 'array' then false
            when jsonb_array_length(target.returned_assessment_snapshot) = 4
            then jsonb_build_array(
              target.assessment_type, target.continuous_assessment, target.examination, target.total_score
            ) is distinct from target.returned_assessment_snapshot
            when jsonb_array_length(target.returned_assessment_snapshot) = 5
            then jsonb_build_array(
              target.assessment_type, target.continuous_assessment, target.examination, target.total_score, target.maximum_score
            ) is distinct from target.returned_assessment_snapshot
            else false
          end
        )
      )
    then
      raise exception 'Only drafts, submitted results, or Returned results meeting the verified republishing rules can be published.';
    end if;
    perform set_config('app.result_action', 'publish', true);
    update public.results
    set status = 'Published',
        published_by = auth.uid(),
        published_at = now(),
        review_reason = null
    where id = target_result_id;
    return;
  elsif decision = 'return' then
    if target.status is distinct from 'Submitted'
      or char_length(coalesce(trim(reason), '')) > 250
    then
      raise exception 'Only submitted results can be returned, with an optional message of up to 250 characters.';
    end if;
    perform set_config('app.result_action', 'return', true);
    update public.results
    set status = 'Returned',
        review_reason = nullif(trim(reason), ''),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = target_result_id;
    return;
  elsif decision = 'unpublish' then
    if target.status is distinct from 'Published'
      or char_length(coalesce(trim(reason), '')) > 250
    then
      raise exception 'Only published results can be unpublished, with an optional internal note of up to 250 characters.';
    end if;
    perform set_config('app.result_action', 'unpublish', true);
    update public.results
    set status = 'Returned',
        review_reason = nullif(trim(reason), ''),
        reviewed_by = auth.uid(),
        reviewed_at = now()
    where id = target_result_id;
    return;
  end if;

  raise exception 'Unsupported results publication action.';
end;
$$;