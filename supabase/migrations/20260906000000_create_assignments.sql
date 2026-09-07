create extension if not exists pgcrypto;

alter table public.contacts
  add column if not exists auth_user_id uuid
  references auth.users(id)
  on delete set null;

create unique index if not exists idx_contacts_auth_user_id
  on public.contacts(auth_user_id)
  where auth_user_id is not null;

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  title text not null,
  instructions text not null default '',
  due_date date not null,
  frequency text not null default 'One-time'
    check (frequency in ('One-time', 'Daily', 'Weekly')),
  published boolean not null default false,
  published_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.assignment_files (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  file_size_bytes integer not null check (file_size_bytes > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_assignments_class_id
  on public.assignments(class_id);

create index if not exists idx_assignments_subject_id
  on public.assignments(subject_id);

create index if not exists idx_assignments_published
  on public.assignments(published, published_at desc);

create index if not exists idx_assignment_files_assignment_id
  on public.assignment_files(assignment_id);

insert into storage.buckets (id, name, public, file_size_limit)
values ('assignment_files', 'assignment_files', false, 10485760)
on conflict (id) do update
set public = false,
    file_size_limit = 10485760;

alter table public.assignments enable row level security;
alter table public.assignment_files enable row level security;

create or replace function public.is_assignment_admin()
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
        'super_admin', 'school_admin', 'administrator', 'admin', 'proprietress'
      )
  );
$$;

create or replace function public.is_assignment_teacher_for(
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
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.users u on u.id = ur.user_id
    join public.teacher_assignments ta on ta.teacher_id = ur.user_id
    where ur.user_id = auth.uid()
      and ur.is_active = true
      and u.status = 'Active'
      and lower(replace(r.name, ' ', '_')) = 'teacher'
      and ta.class_id = target_class_id
      and ta.subject_id = target_subject_id
  );
$$;

create or replace function public.can_manage_assignment(
  target_class_id uuid,
  target_subject_id uuid
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_assignment_admin()
    or public.is_assignment_teacher_for(target_class_id, target_subject_id);
$$;

create or replace function public.can_read_assignment(
  target_class_id uuid
)
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
    join public.user_roles ur on ur.user_id = auth.uid()
    join public.roles r on r.id = ur.role_id
    where ur.is_active = true
      and lower(replace(r.name, ' ', '_')) = 'parent'
      and s.class_id = target_class_id
      and s.status not in ('Inactive', 'Transferred')
      and (
        lower(c.email) = lower(auth.jwt() ->> 'email')
        or c.auth_user_id = auth.uid()
      )
  );
$$;

drop policy if exists "Assignments staff manage same school"
  on public.assignments;
drop policy if exists "Assignments staff manage"
  on public.assignments;

create policy "Assignments staff manage"
on public.assignments
for all
to authenticated
using (public.can_manage_assignment(class_id, subject_id))
with check (public.can_manage_assignment(class_id, subject_id));

drop policy if exists "Assignments parents read own children"
  on public.assignments;
drop policy if exists "Assignments parents read"
  on public.assignments;

create policy "Assignments parents read"
on public.assignments
for select
to authenticated
using (
  published = true
  and public.can_read_assignment(class_id)
);

drop policy if exists "Assignment files staff manage same school"
  on public.assignment_files;
drop policy if exists "Assignment files staff manage"
  on public.assignment_files;

create policy "Assignment files staff manage"
on public.assignment_files
for all
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and public.can_manage_assignment(a.class_id, a.subject_id)
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and public.can_manage_assignment(a.class_id, a.subject_id)
  )
);

drop policy if exists "Assignment files parents read own children"
  on public.assignment_files;
drop policy if exists "Assignment files parents read"
  on public.assignment_files;

create policy "Assignment files parents read"
on public.assignment_files
for select
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = assignment_id
      and a.published = true
      and public.can_read_assignment(a.class_id)
  )
);

drop policy if exists "Assignment storage staff upload"
  on storage.objects;

create policy "Assignment storage staff upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assignment_files'
  and exists (
    select 1
    from public.assignments a
    where a.id::text = split_part(name, '/', 2)
      and public.can_manage_assignment(a.class_id, a.subject_id)
  )
);

drop policy if exists "Assignment storage authorized read"
  on storage.objects;

create policy "Assignment storage authorized read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assignment_files'
  and exists (
    select 1
    from public.assignment_files af
    join public.assignments a on a.id = af.assignment_id
    where af.storage_path = name
      and (
        public.can_manage_assignment(a.class_id, a.subject_id)
        or (
          a.published = true
          and public.can_read_assignment(a.class_id)
        )
      )
  )
);

drop policy if exists "Assignment storage staff delete"
  on storage.objects;

create policy "Assignment storage staff delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'assignment_files'
  and exists (
    select 1
    from public.assignments a
    where a.id::text = split_part(name, '/', 2)
      and public.can_manage_assignment(a.class_id, a.subject_id)
  )
);
