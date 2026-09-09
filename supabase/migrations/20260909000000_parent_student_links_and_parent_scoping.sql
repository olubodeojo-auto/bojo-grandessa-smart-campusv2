create table if not exists public.parent_student_links (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  relationship text null,
  created_at timestamptz not null default now(),
  created_by uuid null,
  unique(student_id, auth_user_id)
);

alter table public.parent_student_links enable row level security;

create or replace function public.is_parent_linked_student(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.parent_student_links psl
    join public.user_roles ur
      on ur.user_id = psl.auth_user_id
      and ur.is_active = true
    join public.roles r
      on r.id = ur.role_id
    join public.users u
      on u.id = psl.auth_user_id
      and u.status = 'Active'
    where psl.student_id = target_student_id
      and psl.auth_user_id = auth.uid()
      and lower(replace(r.name, ' ', '_')) = 'parent'
  );
$$;

create or replace function public.can_read_assignment(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.parent_student_links psl
    join public.students s
      on s.id = psl.student_id
      and s.class_id = target_class_id
      and s.status not in ('Inactive', 'Transferred')
    join public.user_roles ur
      on ur.user_id = psl.auth_user_id
      and ur.is_active = true
    join public.roles r
      on r.id = ur.role_id
    join public.users u
      on u.id = psl.auth_user_id
      and u.status = 'Active'
    where psl.auth_user_id = auth.uid()
      and lower(replace(r.name, ' ', '_')) = 'parent'
  );
$$;

create policy "Parent student links staff access"
on public.parent_student_links
for all
to authenticated
using (public.is_active_staff_user())
with check (public.is_active_staff_user());

drop policy if exists "Students parents read own children" on public.students;
drop policy if exists "Students staff access" on public.students;
create policy "Students staff access"
on public.students
for all
to authenticated
using (public.is_active_staff_user())
with check (public.is_active_staff_user());

create policy "Students parents read own children"
on public.students
for select
to authenticated
using (public.is_parent_linked_student(id));

drop policy if exists "Attendance parents read own children" on public.attendance;
drop policy if exists "Attendance staff access" on public.attendance;
create policy "Attendance staff access"
on public.attendance
for all
to authenticated
using (public.is_active_staff_user())
with check (public.is_active_staff_user());

create policy "Attendance parents read own children"
on public.attendance
for select
to authenticated
using (public.is_parent_linked_student(student_id));

drop policy if exists "Results parents read own children" on public.results;
drop policy if exists "Results staff access" on public.results;
create policy "Results staff access"
on public.results
for all
to authenticated
using (public.is_active_staff_user())
with check (public.is_active_staff_user());

create policy "Results parents read own children"
on public.results
for select
to authenticated
using (
  status in ('Published', 'Approved')
  and public.is_parent_linked_student(student_id)
);

insert into public.parent_student_links (student_id, auth_user_id, relationship)
select distinct
  s.id as student_id,
  c.auth_user_id as auth_user_id,
  c.relationship as relationship
from public.students s
join public.contacts c
  on c.id = s.primary_contact_id
where c.auth_user_id is not null
on conflict (student_id, auth_user_id) do nothing;

insert into public.parent_student_links (student_id, auth_user_id, relationship)
select distinct
  s.id as student_id,
  c.auth_user_id as auth_user_id,
  c.relationship as relationship
from public.students s
join public.contacts c
  on c.id = s.secondary_contact_id
where c.auth_user_id is not null
on conflict (student_id, auth_user_id) do nothing;
