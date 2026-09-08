insert into public.roles (name, description)
values ('Parent', 'Parent portal access')
on conflict (name) do nothing;
