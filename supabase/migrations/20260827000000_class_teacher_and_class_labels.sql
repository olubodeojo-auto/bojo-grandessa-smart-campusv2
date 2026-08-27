alter table if exists public.classes
  add column if not exists class_teacher_id uuid references public.teachers(id) on delete set null;

create index if not exists idx_classes_class_teacher_id on public.classes(class_teacher_id);

update public.classes
set class_name = case lower(trim(class_name))
  when 'nursery 1' then 'Kindergarten 1'
  when 'nursery 2' then 'Kindergarten 2'
  when 'primary 1' then 'Basic 1'
  when 'primary 2' then 'Basic 2'
  when 'primary 3' then 'Basic 3'
  when 'primary 4' then 'Basic 4'
  when 'primary 5' then 'Basic 5'
  when 'primary 6' then 'Basic 6'
  else class_name
end
where lower(trim(class_name)) in (
  'nursery 1', 'nursery 2', 'primary 1', 'primary 2', 'primary 3',
  'primary 4', 'primary 5', 'primary 6'
);

update public.students s
set class_name = c.class_name
from public.classes c
where s.class_id = c.id;

update public.results r
set class_name = c.class_name
from public.classes c
where r.class_id = c.id;