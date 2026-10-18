create or replace function public.publish_result(target_result_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if not public.is_assignment_admin() then
    raise exception 'Only an authorised administrator can publish results.';
  end if;

  select status into current_status
  from public.results
  where id = target_result_id
  for update;

  if not found then
    raise exception 'Result not found.';
  end if;

  if current_status = 'Published' then
    return;
  end if;

  if current_status is distinct from 'Draft' then
    raise exception 'Only draft results can be published by this compatibility workflow. Current status: %.', current_status;
  end if;

  update public.results
  set status = 'Published'
  where id = target_result_id
    and status = 'Draft';

  if not found then
    raise exception 'Result status changed during publication; refresh and verify before retrying.';
  end if;
end;
$$;

revoke all on function public.publish_result(uuid) from public;

revoke all on function public.publish_result(uuid) from anon;

grant execute on function public.publish_result(uuid) to authenticated;
