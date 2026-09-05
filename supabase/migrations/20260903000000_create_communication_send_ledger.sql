create table if not exists public.communication_sends (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null unique,
  audience text not null,
  subject text not null,
  recipient_count integer not null check (recipient_count > 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  status text not null check (status in ('reserved', 'accepted', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists communication_sends_created_at_idx
  on public.communication_sends (created_at);

alter table public.communication_sends enable row level security;

create or replace function public.reserve_communication_send(
  p_created_by uuid,
  p_idempotency_key text,
  p_audience text,
  p_subject text,
  p_recipient_count integer
)
returns table (
  send_id uuid,
  is_duplicate boolean,
  remaining integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_usage integer;
  existing_send public.communication_sends;
  inserted_send public.communication_sends;
begin
  if p_recipient_count <= 0 or p_recipient_count > 100 then
    raise exception 'Recipient count must be between 1 and 100.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('grandessa:communication-daily-quota'));

  select * into existing_send
  from public.communication_sends
  where idempotency_key = p_idempotency_key;

  if existing_send.id is not null then
    select greatest(0, 100 - coalesce(sum(recipient_count), 0))::integer
      into remaining
    from public.communication_sends
    where created_at >= date_trunc('day', now())
      and status in ('reserved', 'accepted');

    send_id := existing_send.id;
    is_duplicate := true;
    return next;
    return;
  end if;

  select coalesce(sum(recipient_count), 0)::integer into current_usage
  from public.communication_sends
  where created_at >= date_trunc('day', now())
    and status in ('reserved', 'accepted');

  if current_usage + p_recipient_count > 100 then
    raise exception 'Daily communication email limit reached.' using errcode = 'P0001';
  end if;

  insert into public.communication_sends (
    created_by,
    idempotency_key,
    audience,
    subject,
    recipient_count,
    status
  ) values (
    p_created_by,
    p_idempotency_key,
    p_audience,
    p_subject,
    p_recipient_count,
    'reserved'
  ) returning * into inserted_send;

  send_id := inserted_send.id;
  is_duplicate := false;
  remaining := 100 - current_usage - p_recipient_count;
  return next;
end;
$$;

grant execute on function public.reserve_communication_send(uuid, text, text, text, integer) to service_role;
revoke execute on function public.reserve_communication_send(uuid, text, text, text, integer) from anon, authenticated, public;
