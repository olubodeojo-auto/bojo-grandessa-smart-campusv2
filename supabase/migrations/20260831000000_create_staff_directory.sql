create extension if not exists pgcrypto;

create table if not exists public.staff_directory (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  position text not null,
  bio text null,
  photo_url text null,
  display_order integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_directory_display_order on public.staff_directory(display_order);
create index if not exists idx_staff_directory_created_at on public.staff_directory(created_at desc);

create or replace function public.set_staff_directory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_staff_directory_set_updated_at on public.staff_directory;

create trigger trg_staff_directory_set_updated_at
before update on public.staff_directory
for each row
execute function public.set_staff_directory_updated_at();

alter table public.staff_directory enable row level security;

create policy "Staff directory public read"
on public.staff_directory
for select
to public
using (true);

create policy "Staff directory admin insert"
on public.staff_directory
for insert
to authenticated
with check (
  exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
);

create policy "Staff directory admin update"
on public.staff_directory
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
)
with check (
  exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
);

create policy "Staff directory admin delete"
on public.staff_directory
for delete
to authenticated
using (
  exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'staff_directory_photos',
  'staff_directory_photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

create policy "Staff directory photos public read"
on storage.objects
for select
to public
using (bucket_id = 'staff_directory_photos');

create policy "Staff directory photos admin insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'staff_directory_photos'
  and exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
);

create policy "Staff directory photos admin update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'staff_directory_photos'
  and exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
)
with check (
  bucket_id = 'staff_directory_photos'
  and exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
);

create policy "Staff directory photos admin delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'staff_directory_photos'
  and exists (
    select 1
    from public.users u
    join public.user_roles ur on ur.user_id = u.id
    join public.roles r on r.id = ur.role_id
    where u.id = auth.uid()
      and ur.is_active = true
      and lower(replace(r.name, ' ', '_')) in ('super_admin', 'school_admin', 'administrator', 'admin', 'proprietress')
  )
);
