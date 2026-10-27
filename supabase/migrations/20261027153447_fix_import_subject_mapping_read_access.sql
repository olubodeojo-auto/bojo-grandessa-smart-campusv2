-- Let assigned class teachers load an empty saved-mapping list before they have aliases to reuse.
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
revoke all on function public.get_result_import_subject_mappings_v1(uuid) from public, anon;
grant execute on function public.get_result_import_subject_mappings_v1(uuid) to authenticated;
notify pgrst, 'reload schema';
