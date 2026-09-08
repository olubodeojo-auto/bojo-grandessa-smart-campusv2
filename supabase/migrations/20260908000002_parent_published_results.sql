drop policy if exists "Results parents read own children" on public.results;

create policy "Results parents read own children"
on public.results
for select
to authenticated
using (
  status in ('Published', 'Approved')
  and public.is_parent_linked_student(student_id)
);
