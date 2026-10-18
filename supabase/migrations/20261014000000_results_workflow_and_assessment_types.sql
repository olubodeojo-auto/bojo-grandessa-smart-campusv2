do $$
begin
  if to_regclass('public.results') is null
    or to_regclass('public.students') is null
    or to_regclass('public.classes') is null
    or to_regclass('public.subjects') is null
    or to_regclass('public.users') is null
    or to_regclass('public.user_roles') is null
    or to_regclass('public.roles') is null
  then
    raise exception 'Results workflow requires public.results, students, classes, subjects, users, user_roles, and roles.';
  end if;
  -- Preserve existing rows; never infer assessment type, class, or subject.
if to_regprocedure('public.is_assignment_admin()') is null
    or to_regprocedure('public.is_parent_linked_student(uuid)') is null
  then
    raise exception 'Results workflow requires the existing administrator and parent-link authorization helpers.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'status'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'first_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'last_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_roles' and column_name = 'user_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_roles' and column_name = 'role_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_roles' and column_name = 'is_active'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'roles' and column_name = 'name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'class_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes' and column_name = 'class_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes' and column_name = 'class_teacher_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'subjects' and column_name = 'subject_name'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'student_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'academic_year'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'term'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'status'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'continuous_assessment'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'examination'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'total_score'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'grade'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'results' and column_name = 'remark'
  ) then
    raise exception 'The live results schema differs from the required results contract; review columns before applying this migration.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'results'
      and policyname not in (
        'Results read by same school', 'Results write by staff in same school',
        'Results staff access', 'Results parents read own children',
        'Results administrators manage', 'Results assigned teachers read',
        'Results teachers insert own drafts', 'Results teachers update own drafts',
        'Results teachers update own drafts and returned',
        'Results teachers delete own drafts', 'Results parents read published children'
      )
  ) then
    raise exception 'Unexpected results RLS policy found. Inspect the live policy definitions and update this migration allowlist before applying.';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'result_change_log'
      and policyname not in ('Result audit administrators read')
  ) then
    raise exception 'Unexpected result_change_log RLS policy found. Inspect the live policy definitions before applying.';
  end if;
end;
$$;

alter table public.results
  add column if not exists class_id uuid,
  add column if not exists subject_id uuid,
  add column if not exists class_name text,
  add column if not exists subject_name text,
  add column if not exists teacher_name text,
  add column if not exists teacher_id uuid,
  add column if not exists assessment_type text,
  add column if not exists calculation_mode text not null default 'Manual',
  add column if not exists maximum_score numeric,
  add column if not exists created_by uuid,
  add column if not exists submitted_by uuid,
  add column if not exists submitted_by_name text,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_by uuid,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_by uuid,
  add column if not exists published_at timestamptz,
  add column if not exists review_reason text,
  add column if not exists returned_assessment_snapshot jsonb;

alter table public.results
  alter column assessment_type set not null;

update public.results
set returned_assessment_snapshot = jsonb_build_array(
  assessment_type, continuous_assessment, examination, total_score, maximum_score
)
where status = 'Returned'
  and published_at is not null
  and returned_assessment_snapshot is null;

do $$
begin
  if exists (
    select 1 from public.results r
    left join public.classes c on c.id = r.class_id
    where r.class_id is not null and c.id is null
  ) or exists (
    select 1 from public.results r
    left join public.subjects s on s.id = r.subject_id
    where r.subject_id is not null and s.id is null
  ) or exists (
    select 1 from public.results r
    left join public.users u on u.id = r.teacher_id
    where r.teacher_id is not null and u.id is null
  ) then
    raise exception 'Existing result class, subject, or teacher IDs do not resolve to the expected live tables; map them before applying this migration.';
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_class_id_fkey') then
    alter table public.results
      add constraint results_class_id_fkey foreign key (class_id) references public.classes(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_subject_id_fkey') then
    alter table public.results
      add constraint results_subject_id_fkey foreign key (subject_id) references public.subjects(id) on delete restrict;
  end if;
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.results'::regclass
      and conname = 'results_teacher_id_fkey'
      and contype = 'f'
      and confrelid <> 'public.users'::regclass
  ) then
    alter table public.results drop constraint results_teacher_id_fkey;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.results'::regclass
      and conname = 'results_teacher_id_fkey'
      and contype = 'f'
      and confrelid = 'public.users'::regclass
  ) then
    alter table public.results
      add constraint results_teacher_id_fkey foreign key (teacher_id) references public.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_created_by_fkey') then
    alter table public.results
      add constraint results_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_submitted_by_fkey') then
    alter table public.results
      add constraint results_submitted_by_fkey foreign key (submitted_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_reviewed_by_fkey') then
    alter table public.results
      add constraint results_reviewed_by_fkey foreign key (reviewed_by) references auth.users(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.results'::regclass and conname = 'results_published_by_fkey') then
    alter table public.results
      add constraint results_published_by_fkey foreign key (published_by) references auth.users(id) on delete set null;
  end if;
end;
$$;

create index if not exists idx_results_class_id on public.results(class_id);
create index if not exists idx_results_subject_id on public.results(subject_id);
create index if not exists idx_results_teacher_id on public.results(teacher_id);
create index if not exists idx_results_created_by_status on public.results(created_by, status);
create index if not exists idx_results_class_subject_session_term
  on public.results(class_id, subject_id, academic_year, term);

alter table public.results
  alter column continuous_assessment drop not null,
  alter column examination drop not null,
  alter column total_score drop not null,
  alter column grade drop not null,
  alter column remark drop not null;

alter table public.results
  drop constraint if exists results_status_check,
  drop constraint if exists results_assessment_type_check,
  drop constraint if exists results_assessment_marks_check,
  drop constraint if exists results_result_lifecycle_complete_check,
  drop constraint if exists results_score_ranges_check,
  drop constraint if exists results_continuous_assessment_check,
  drop constraint if exists results_examination_check,
  drop constraint if exists results_total_score_check,
  drop constraint if exists results_maximum_score_check;

alter table public.results
  add constraint results_status_check
    check (status in ('Draft', 'Submitted', 'Returned', 'Published', 'Approved')),
  add constraint results_assessment_type_check
    check (assessment_type in ('CA', 'Examination', 'Combined')),
  add constraint results_calculation_mode_check
    check (calculation_mode in ('Manual', 'Automatic')),
  add constraint results_maximum_score_check
    check (maximum_score is null or maximum_score > 0);

create or replace function public.is_result_admin_for(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_assignment_admin()
    and exists (select 1 from public.students s where s.id = target_student_id);
$$;

create or replace function public.is_result_teacher_for(
  target_student_id uuid,
  target_class_id uuid,
  target_subject_id uuid
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
    join public.subjects subject_record on subject_record.id = target_subject_id
    join public.user_roles ur on ur.user_id = u.id and ur.is_active = true
    join public.roles role_record on role_record.id = ur.role_id
    join public.classes c
      on c.id = target_class_id
      and c.class_teacher_id = u.id
    join public.students s
      on s.id = target_student_id
      and s.class_id = c.id
    where u.id = auth.uid()
      and u.status = 'Active'
      and lower(replace(role_record.name, ' ', '_')) = 'teacher'
  );
$$;

revoke all on function public.is_result_admin_for(uuid) from public, anon;
revoke all on function public.is_result_teacher_for(uuid, uuid, uuid) from public, anon;
grant execute on function public.is_result_admin_for(uuid) to authenticated;
grant execute on function public.is_result_teacher_for(uuid, uuid, uuid) to authenticated;

create table if not exists public.result_change_log (
  id bigint generated always as identity primary key,
  result_id uuid not null,
  changed_by uuid references auth.users(id) on delete set null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_record jsonb,
  new_record jsonb,
  changed_at timestamptz not null default now()
);

revoke all on public.result_change_log from public, anon, authenticated;
grant select on public.result_change_log to authenticated;

create or replace function public.audit_result_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.result_change_log (result_id, changed_by, action, old_record, new_record)
    values (old.id, auth.uid(), tg_op, to_jsonb(old), null);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.result_change_log (result_id, changed_by, action, old_record, new_record)
    values (new.id, auth.uid(), tg_op, to_jsonb(old), to_jsonb(new));
  else
    insert into public.result_change_log (result_id, changed_by, action, old_record, new_record)
    values (new.id, auth.uid(), tg_op, null, to_jsonb(new));
  end if;
  return new;
end;
$$;

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
        raise exception 'Only an authorised administrator can publish a result.';
      end if;
      if old.status not in ('Draft', 'Submitted')
        and not (
          old.status is not distinct from 'Returned'
          and old.published_at is not null
          and old.returned_assessment_snapshot is not null
          and case
            when jsonb_typeof(old.returned_assessment_snapshot) = 'array'
              and case when jsonb_typeof(old.returned_assessment_snapshot) = 'array'
                then jsonb_array_length(old.returned_assessment_snapshot) = 4
                else false
              end
            then jsonb_build_array(
              new.assessment_type, new.continuous_assessment, new.examination, new.total_score
            ) is distinct from old.returned_assessment_snapshot
            else jsonb_build_array(
              new.assessment_type, new.continuous_assessment, new.examination, new.total_score, new.maximum_score
            ) is distinct from old.returned_assessment_snapshot
          end
        )
      then
        raise exception 'An unpublished result must have changed assessment values before republishing.';
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
    and target.published_at is not null
    and target.review_reason = nullif(trim(reason), '')
  then
    return;
  end if;

  if decision = 'publish' then
    if target.status is distinct from 'Draft'
      and target.status is distinct from 'Submitted'
      and not (
        target.status is not distinct from 'Returned'
        and target.published_at is not null
        and target.returned_assessment_snapshot is not null
        and case
          when jsonb_typeof(target.returned_assessment_snapshot) = 'array'
            and case when jsonb_typeof(target.returned_assessment_snapshot) = 'array'
              then jsonb_array_length(target.returned_assessment_snapshot) = 4
              else false
            end
          then jsonb_build_array(
            target.assessment_type, target.continuous_assessment, target.examination, target.total_score
          ) is distinct from target.returned_assessment_snapshot
          else jsonb_build_array(
            target.assessment_type, target.continuous_assessment, target.examination, target.total_score, target.maximum_score
          ) is distinct from target.returned_assessment_snapshot
        end
      )
    then
      raise exception 'Only draft results or corrected unpublished results can be published.';
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

  raise exception 'Unsupported result publication action.';
end;
$$;

create or replace function public.submit_result(target_result_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target public.results%rowtype;
  submitter_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in is required to submit a result.';
  end if;

  select * into target from public.results where id = target_result_id for update;
  if not found then
    raise exception 'Result not found.';
  end if;
  if target.status not in ('Draft', 'Returned') or target.published_at is not null then
    raise exception 'Only a draft or unpublished returned result can be submitted.';
  end if;
  if not public.is_result_teacher_for(target.student_id, target.class_id, target.subject_id) then
    raise exception 'Only the current class teacher can submit results for this class.';
  end if;

  select coalesce(
    nullif(trim(concat_ws(' ', nullif(trim(u.first_name), ''), nullif(trim(u.last_name), ''))), ''),
    auth.uid()::text
  )
  into submitter_name
  from public.users u
  where u.id = auth.uid();
  submitter_name := coalesce(submitter_name, auth.uid()::text);

  perform set_config('app.result_action', 'submit', true);
  update public.results
  set status = 'Submitted',
      submitted_by = auth.uid(),
      submitted_by_name = submitter_name,
      submitted_at = now(),
      review_reason = null
  where id = target_result_id;
end;
$$;

revoke all on function public.review_result(uuid, text, text) from public, anon;
revoke all on function public.submit_result(uuid) from public, anon;
grant execute on function public.review_result(uuid, text, text) to authenticated;
grant execute on function public.submit_result(uuid) to authenticated;

create or replace function public.set_results_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_results_set_updated_at on public.results;
create trigger trg_results_set_updated_at
  before update on public.results
  for each row execute function public.set_results_updated_at();

drop trigger if exists trg_results_audit_changes on public.results;
create trigger trg_results_audit_changes
  after insert or update or delete on public.results
  for each row execute function public.audit_result_changes();

drop trigger if exists trg_results_lifecycle_guard on public.results;
create trigger trg_results_lifecycle_guard
  before insert or update or delete on public.results
  for each row execute function public.prevent_result_lifecycle_bypass();

revoke all on public.results from public, anon, authenticated;
grant select, insert, update, delete on public.results to authenticated;

drop policy if exists "Results read by same school" on public.results;
drop policy if exists "Results write by staff in same school" on public.results;
drop policy if exists "Results staff access" on public.results;
drop policy if exists "Results parents read own children" on public.results;
drop policy if exists "Results administrators manage" on public.results;
drop policy if exists "Results assigned teachers read" on public.results;
drop policy if exists "Results teachers insert own drafts" on public.results;
drop policy if exists "Results teachers update own drafts" on public.results;
drop policy if exists "Results teachers update own drafts and returned" on public.results;
drop policy if exists "Results teachers delete own drafts" on public.results;
drop policy if exists "Results parents read published children" on public.results;

create policy "Results administrators manage"
  on public.results for all to authenticated
  using (public.is_result_admin_for(student_id))
  with check (public.is_result_admin_for(student_id));

create policy "Results assigned teachers read"
  on public.results for select to authenticated
  using (public.is_result_teacher_for(student_id, class_id, subject_id));

create policy "Results teachers insert own drafts"
  on public.results for insert to authenticated
  with check (
    created_by = auth.uid()
    and teacher_id = auth.uid()
    and status = 'Draft'
    and public.is_result_teacher_for(student_id, class_id, subject_id)
  );

create policy "Results teachers update own drafts and returned"
  on public.results for update to authenticated
  using (
    status in ('Draft', 'Returned')
    and (status <> 'Returned' or published_at is null)
    and public.is_result_teacher_for(student_id, class_id, subject_id)
  )
  with check (
    status in ('Draft', 'Submitted', 'Returned')
    and public.is_result_teacher_for(student_id, class_id, subject_id)
  );

create policy "Results parents read published children"
  on public.results for select to authenticated
  using (
    status in ('Published', 'Approved')
    and public.is_parent_linked_student(student_id)
  );

drop policy if exists "Result audit administrators read" on public.result_change_log;

create policy "Result audit administrators read"
  on public.result_change_log for select to authenticated
  using (public.is_assignment_admin());
