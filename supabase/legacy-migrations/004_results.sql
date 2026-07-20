-- ==========================================
-- GRANDESSA SMART CAMPUS
-- Migration 004 - Results
-- ==========================================

-- Terms

create table if not exists terms (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    name text not null,

    academic_year text not null,

    start_date date,

    end_date date,

    is_current boolean default false,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Assessments

create table if not exists assessments (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    subject_id uuid not null
        references subjects(id),

    class_id uuid not null
        references classes(id),

    teacher_id uuid
        references teachers(id),

    term_id uuid
        references terms(id),

    title text not null,

    assessment_type text not null check (
        assessment_type in (
            'Assignment',
            'Test',
            'Exam',
            'Project'
        )
    ),

    total_marks numeric(6,2) default 100,

    assessment_date date,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Scores

create table if not exists scores (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    assessment_id uuid not null
        references assessments(id)
        on delete cascade,

    student_id uuid not null
        references students(id)
        on delete cascade,

    score numeric(6,2) not null,

    remarks text,

    created_at timestamptz default now(),

    updated_at timestamptz default now(),

    unique(assessment_id, student_id)
);

-- Report Cards

create table if not exists report_cards (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    student_id uuid not null
        references students(id),

    class_id uuid not null
        references classes(id),

    term_id uuid not null
        references terms(id),

    total_score numeric(8,2),

    average_score numeric(6,2),

    position integer,

    teacher_comment text,

    principal_comment text,

    published boolean default false,

    published_at timestamptz,

    created_at timestamptz default now(),

    updated_at timestamptz default now(),

    unique(student_id, class_id, term_id)
);

-- Indexes

create index if not exists idx_terms_school
on terms(school_id);

create index if not exists idx_assessments_school
on assessments(school_id);

create index if not exists idx_scores_student
on scores(student_id);

create index if not exists idx_scores_assessment
on scores(assessment_id);

create index if not exists idx_report_cards_student
on report_cards(student_id);

create index if not exists idx_report_cards_term
on report_cards(term_id);