do $$
begin
  if to_regclass('public.result_import_review_drafts') is null
    or to_regclass('public.school_settings') is null
    or to_regclass('public.classes') is null
    or to_regprocedure('public.is_assignment_admin()') is null
  then
    raise exception 'Saved workbook listing requires the review-draft table, school settings, classes, and administrator authorization helper.';
  end if;

  if exists (
    select 1
    from (
      values
        ('result_import_review_drafts', 'school_id'),
        ('result_import_review_drafts', 'created_by'),
        ('result_import_review_drafts', 'class_id'),
        ('result_import_review_drafts', 'workbook_key'),
        ('result_import_review_drafts', 'updated_at'),
        ('school_settings', 'school_id'),
        ('classes', 'id'),
        ('classes', 'class_teacher_id')
    ) as required(table_name, column_name)
    where not exists (
      select 1
      from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = required.table_name
        and column_info.column_name = required.column_name
    )
  ) then
    raise exception 'Saved workbook listing requires the expected school, owner, class, workbook, and timestamp columns.';
  end if;
end;
$$;

create or replace function public.get_result_import_review_workbooks(
  target_school_id uuid
)
returns table (
  workbook_key text,
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

  if target_school_id is null then
    raise exception 'A school must be selected.';
  end if;

  if not exists (
    select 1
    from public.school_settings s
    where s.school_id = target_school_id
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
    raise exception 'Only an administrator or a class teacher with saved pupil reviews can list import workbooks.';
  end if;

  return query
  select
    d.workbook_key,
    count(*)::integer,
    max(d.updated_at)
  from public.result_import_review_drafts d
  where d.school_id = target_school_id
    and (
      public.is_assignment_admin()
      or (
        d.created_by = actor_id
        and exists (
          select 1
          from public.classes c
          where c.id = d.class_id
            and c.class_teacher_id = actor_id
        )
      )
    )
  group by d.workbook_key
  order by max(d.updated_at) desc;
end;
$$;

revoke all on function public.get_result_import_review_workbooks(uuid) from public, anon;
grant execute on function public.get_result_import_review_workbooks(uuid) to authenticated;

notify pgrst, 'reload schema';
