-- ==========================================
-- GRANDESSA SMART CAMPUS
-- Migration 005 - Finance
-- ==========================================

-- Fee Structures

create table if not exists fee_structures (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    class_id uuid
        references classes(id),

    name text not null,

    amount numeric(12,2) not null,

    description text,

    is_active boolean default true,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Student Invoices

create table if not exists invoices (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    student_id uuid not null
        references students(id)
        on delete cascade,

    fee_structure_id uuid
        references fee_structures(id),

    invoice_number text unique not null,

    amount numeric(12,2) not null,

    discount numeric(12,2) default 0,

    balance numeric(12,2) not null,

    due_date date,

    status text not null default 'Unpaid'
        check (status in ('Unpaid','Partially Paid','Paid','Cancelled')),

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Payments

create table if not exists payments (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    invoice_id uuid not null
        references invoices(id)
        on delete cascade,

    student_id uuid not null
        references students(id)
        on delete cascade,

    amount numeric(12,2) not null,

    payment_method text,

    payment_reference text,

    payment_date timestamptz default now(),

    notes text,

    created_at timestamptz default now()
);

-- Scholarships

create table if not exists scholarships (

    id uuid primary key default gen_random_uuid(),

    school_id uuid not null
        references schools(id)
        on delete cascade,

    student_id uuid not null
        references students(id)
        on delete cascade,

    title text not null,

    amount numeric(12,2),

    percentage numeric(5,2),

    start_date date,

    end_date date,

    remarks text,

    created_at timestamptz default now(),

    updated_at timestamptz default now()
);

-- Indexes

create index if not exists idx_fee_structures_school
on fee_structures(school_id);

create index if not exists idx_invoices_school
on invoices(school_id);

create index if not exists idx_invoices_student
on invoices(student_id);

create index if not exists idx_payments_invoice
on payments(invoice_id);

create index if not exists idx_payments_student
on payments(student_id);

create index if not exists idx_scholarships_student
on scholarships(student_id);