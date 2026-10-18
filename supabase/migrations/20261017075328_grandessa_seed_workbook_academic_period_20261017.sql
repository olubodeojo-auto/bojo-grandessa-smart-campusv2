do $$
declare s_id uuid;
begin
  select id into s_id from public.academic_sessions where session_name='2025/2026' limit 1;
  if s_id is null then
    insert into public.academic_sessions(session_name,start_date,end_date,is_current,is_locked)
    values ('2025/2026',null,null,false,false) returning id into s_id;
  end if;
  if not exists(select 1 from public.terms where academic_session_id=s_id and term_name='Third Term') then
    insert into public.terms(academic_session_id,term_name,start_date,end_date,is_current)
    values(s_id,'Third Term',null,null,false);
  end if;
end $$;
notify pgrst, 'reload schema';
