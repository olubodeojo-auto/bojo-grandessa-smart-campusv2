-- ==========================================
-- GRANDESSA SMART CAMPUS
-- Migration 001 - Foundation
-- ==========================================

create extension if not exists pgcrypto;

-- Schools

create table if not exists schools (

    id uuid primary key default gen_random_uuid(),

    name text not null unique,

    address text,

    phone text,

    email text,

    website text,

    logo_url text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Roles

create table if not exists roles (

    id uuid primary key default gen_random_uuid(),

    name text not null unique,

    created_at timestamptz default now()
);

-- Users

create table if not exists users (

    id uuid primary key,

    school_id uuid
        references schools(id)
        on delete cascade,

    role_id uuid
        references roles(id),

    first_name text not null,

    last_name text not null,

    email text unique,

    phone text,

    avatar_url text,

    is_active boolean default true,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

create index if not exists idx_users_school
on users(school_id);

create index if not exists idx_users_role
on users(role_id);