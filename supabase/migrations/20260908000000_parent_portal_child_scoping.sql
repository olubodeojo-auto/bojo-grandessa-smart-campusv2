create or replace function public.is_parent_linked_student(target_student_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.students s
    join public.contacts c
      on c.id = s.primary_contact_id
      or c.id = s.secondary_contact_id
    join public.user_roles ur
      on ur.user_id = auth.uid()
      and ur.is_active = true
    join public.roles r
      on r.id = ur.role_id
    join public.users u
      on u.id = ur.user_id
      and u.status = 'Active'
    where s.id = target_student_id
      and c.auth_user_id = auth.uid()
      and lower(replace(r.name, ' ', '_')) = 'parent'
  );
$$;

create or replace function public.is_active_staff_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.users u on u.id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and u.status = 'Active'
      and lower(replace(r.name, ' ', '_')) in (
        'proprietress',
        'super_admin',
        'school_admin',
        'administrator',
        'admin',
        'teacher'
      )
  );
$$;

alter table public.students enable row level security;
alter table public.attendance enable row level security;
alter table public.results enable row level security;

drop policy if exists "Authenticated users can read students" on public.students;
drop policy if exists "Students Full Access" on public.students;
drop policy if exists "Students staff access" on public.students;
drop policy if exists "Students parents read own children" on public.students;

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

drop policy if exists "Attendance Full Access" on public.attendance;
drop policy if exists "Attendance staff access" on public.attendance;
drop policy if exists "Attendance parents read own children" on public.attendance;

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

drop policy if exists "Results read by same school" on public.results;
drop policy if exists "Results write by staff in same school" on public.results;
drop policy if exists "Results staff access" on public.results;
drop policy if exists "Results parents read own children" on public.results;

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
using (public.is_parent_linked_student(student_id));

create or replace function public.can_read_assignment(target_class_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.students s
    join public.contacts c
      on c.id = s.primary_contact_id
      or c.id = s.secondary_contact_id
    join public.user_roles ur
      on ur.user_id = auth.uid()
      and ur.is_active = true
    join public.roles r
      on r.id = ur.role_id
    join public.users u
      on u.id = ur.user_id
      and u.status = 'Active'
    where lower(replace(r.name, ' ', '_')) = 'parent'
      and s.class_id = target_class_id
      and s.status not in ('Inactive', 'Transferred')
      and c.auth_user_id = auth.uid()
  );
$$;