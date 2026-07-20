-- ==========================================
-- GRANDESSA SMART CAMPUS
-- Migration 007 - Seed Data
-- ==========================================

-- Default School

insert into schools (

    name,
    code,
    country,
    is_active

)
values (

    'Grandessa Smart Campus',
    'GRANDESSA',
    'Nigeria',
    true

)
on conflict (code) do nothing;

-- Default Roles

insert into roles (name)
values
('Super Admin'),
('School Admin'),
('Teacher'),
('Parent')
on conflict do nothing;

-- Default Classes

insert into classes (
    school_id,
    name,
    level,
    capacity
)
select
    s.id,
    c.name,
    c.level,
    40
from schools s
cross join (
    values
    ('Nursery 1','Nursery'),
    ('Nursery 2','Nursery'),
    ('Primary 1','Primary'),
    ('Primary 2','Primary'),
    ('Primary 3','Primary'),
    ('Primary 4','Primary'),
    ('Primary 5','Primary'),
    ('Primary 6','Primary'),
    ('JSS 1','Junior'),
    ('JSS 2','Junior'),
    ('JSS 3','Junior'),
    ('SS 1','Senior'),
    ('SS 2','Senior'),
    ('SS 3','Senior')
) as c(name, level);

-- Default Subjects

insert into subjects (
    school_id,
    name,
    code
)
select
    s.id,
    subj.name,
    subj.code
from schools s
cross join (
    values
    ('Mathematics','MTH'),
    ('English Language','ENG'),
    ('Basic Science','SCI'),
    ('Computer Studies','CMP'),
    ('Social Studies','SOS'),
    ('Agricultural Science','AGR'),
    ('Civic Education','CVE'),
    ('Business Studies','BUS'),
    ('Economics','ECO'),
    ('Biology','BIO'),
    ('Chemistry','CHM'),
    ('Physics','PHY')
) as subj(name, code);