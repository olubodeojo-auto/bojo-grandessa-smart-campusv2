-- ==========================================
-- GRANDESSA SMART CAMPUS
-- Migration 003 - Operations
-- ==========================================

-- Attendance

create table if not exists attendance (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    student_id uuid not null
        references students(id)
        on delete cascade,

    class_id uuid
        references classes(id),

    attendance_date date not null,

    status text not null check (
        status in (
            'Present',
            'Absent',
            'Late',
            'Excused'
        )
    ),

    remarks text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Homework

create table if not exists homework (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    class_id uuid
        references classes(id),

    subject_id uuid
        references subjects(id),

    teacher_id uuid
        references teachers(id),

    title text not null,

    description text,

    due_date date,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Announcements

create table if not exists announcements (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    title text not null,

    content text not null,

    published boolean default false,

    published_at timestamptz,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Admissions

create table if not exists admissions (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    first_name text not null,

    last_name text not null,

    email text,

    phone text,

    gender text,

    date_of_birth date,

    desired_class text,

    status text default 'Pending',

    notes text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Gallery

create table if not exists gallery (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    title text,

    image_url text not null,

    description text,

    created_at timestamptz default now()
);

-- Indexes

create index if not exists idx_attendance_student
on attendance(student_id);

create index if not exists idx_attendance_school
on attendance(school_id);

create index if not exists idx_homework_school
on homework(school_id);

create index if not exists idx_announcements_school
on announcements(school_id);

create index if not exists idx_admissions_school
on admissions(school_id);

create index if not exists idx_gallery_school
on gallery(school_id);