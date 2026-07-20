-- ==========================================
-- GRANDESSA SMART CAMPUS
-- Migration 006 - Security
-- ==========================================

-- Enable Row Level Security

alter table schools enable row level security;
alter table users enable row level security;
alter table roles enable row level security;

alter table classes enable row level security;
alter table subjects enable row level security;
alter table teachers enable row level security;
alter table parents enable row level security;
alter table students enable row level security;

alter table attendance enable row level security;
alter table homework enable row level security;
alter table announcements enable row level security;
alter table admissions enable row level security;
alter table gallery enable row level security;

alter table terms enable row level security;
alter table assessments enable row level security;
alter table scores enable row level security;
alter table report_cards enable row level security;

alter table fee_structures enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;
alter table scholarships enable row level security;

-- Read Policies

create policy "Authenticated users can read schools"
on schools
for select
to authenticated
using (true);

create policy "Authenticated users can read students"
on students
for select
to authenticated
using (true);

create policy "Authenticated users can read teachers"
on teachers
for select
to authenticated
using (true);

create policy "Authenticated users can read parents"
on parents
for select
to authenticated
using (true);

create policy "Authenticated users can read classes"
on classes
for select
to authenticated
using (true);

create policy "Authenticated users can read subjects"
on subjects
for select
to authenticated
using (true);

-- Full Access Policies (temporary during development)

create policy "Students Full Access"
on students
for all
to authenticated
using (true)
with check (true);

create policy "Teachers Full Access"
on teachers
for all
to authenticated
using (true)
with check (true);

create policy "Parents Full Access"
on parents
for all
to authenticated
using (true)
with check (true);

create policy "Classes Full Access"
on classes
for all
to authenticated
using (true)
with check (true);

create policy "Subjects Full Access"
on subjects
for all
to authenticated
using (true)
with check (true);

create policy "Attendance Full Access"
on attendance
for all
to authenticated
using (true)
with check (true);

create policy "Homework Full Access"
on homework
for all
to authenticated
using (true)
with check (true);

create policy "Announcements Full Access"
on announcements
for all
to authenticated
using (true)
with check (true);

create policy "Admissions Full Access"
on admissions
for all
to authenticated
using (true)
with check (true);

create policy "Gallery Full Access"
on gallery
for all
to authenticated
using (true)
with check (true);

create policy "Terms Full Access"
on terms
for all
to authenticated
using (true)
with check (true);

create policy "Assessments Full Access"
on assessments
for all
to authenticated
using (true)
with check (true);

create policy "Scores Full Access"
on scores
for all
to authenticated
using (true)
with check (true);

create policy "Report Cards Full Access"
on report_cards
for all
to authenticated
using (true)
with check (true);

create policy "Finance Full Access"
on fee_structures
for all
to authenticated
using (true)
with check (true);

create policy "Invoices Full Access"
on invoices
for all
to authenticated
using (true)
with check (true);

create policy "Payments Full Access"
on payments
for all
to authenticated
using (true)
with check (true);

create policy "Scholarships Full Access"
on scholarships
for all
to authenticated
using (true)
with check (true);