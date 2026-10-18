create or replace function public.publish_result(target_result_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Keep the legacy RPC name for existing clients, but route publication
  -- through the guarded lifecycle workflow so status, actor and timestamp stay consistent.
  perform public.review_result(target_result_id, 'publish', null);
end;
$$;

revoke all on function public.publish_result(uuid) from public, anon;
grant execute on function public.publish_result(uuid) to authenticated;
notify pgrst, 'reload schema';
