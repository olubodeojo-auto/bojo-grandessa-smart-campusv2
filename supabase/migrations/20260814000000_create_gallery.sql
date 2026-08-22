create table if not exists public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  title text,
  caption text,
  storage_path text not null,
  url text not null,
  file_size_bytes integer,
  file_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gallery_images_created_at on public.gallery_images(created_at desc);

-- Set up Storage bucket for gallery (if not exists)
-- Run manual: mkdir -p storage/gallery_images and configure policies

-- Create a storage policy for admin upload (handled via Supabase dashboard or service role)
