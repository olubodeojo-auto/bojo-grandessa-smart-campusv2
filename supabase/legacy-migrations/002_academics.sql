-- ==========================================
-- GRANDESSA SMART CAMPUS
-- Migration 002 - Academics
-- ==========================================

-- ==========================================
-- Classes
-- ==========================================

create table if not exists classes (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    name text not null,

    level text not null,

    section text,

    description text,

    capacity integer default 40,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- ==========================================
-- Subjects
-- ==========================================

create table if not exists subjects (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    name text not null,

    code text,

    description text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- ==========================================
-- Teachers
-- ==========================================

create table if not exists teachers (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    employee_number text unique not null,

    first_name text not null,

    last_name text not null,

    middle_name text,

    gender text,

    date_of_birth date,

    email text,

    phone text,

    address text,

    qualification text,

    specialization text,

    employment_type text,

    date_employed date,

    passport_url text,

    status text default 'Active',

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- ==========================================
-- Parents
-- ==========================================

create table if not exists parents (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    first_name text not null,

    last_name text not null,

    email text,

    phone text,

    occupation text,

    address text,

    relationship text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- ==========================================
-- Students
-- ==========================================

create table if not exists students (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    admission_number text unique not null,

    class_id uuid
        references classes(id),

    parent_id uuid
        references parents(id),

    first_name text not null,

    last_name text not null,

    middle_name text,

    gender text,

    date_of_birth date,

    email text,

    phone text,

    address text,

    passport_url text,

    blood_group text,

    genotype text,

    allergies text,

    medical_notes text,

    admission_date date,

    status text default 'Active',

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- ==========================================
-- Helpful Indexes
-- ==========================================

create index if not exists idx_students_school
on students(school_id);

create index if not exists idx_students_class
on students(class_id);

create index if not exists idx_teachers_school
on teachers(school_id);

create index if not exists idx_parents_school
on parents(school_id);

create index if not exists idx_subjects_school
on subjects(school_id);

create index if not exists idx_classes_school
on classes(school_id);