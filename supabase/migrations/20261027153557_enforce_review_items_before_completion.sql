-- Completed pupil entries must have at least one subject and one linked result per subject.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'result_import_review_drafts_completed_entry_integrity_check'
      and conrelid = 'public.result_import_review_drafts'::regclass
  ) then
    alter table public.result_import_review_drafts
      add constraint result_import_review_drafts_completed_entry_integrity_check
      check (
        workflow_status is null
        or (
          case
            when jsonb_typeof(draft_payload -> 'items') = 'array'
            then jsonb_array_length(draft_payload -> 'items') > 0
            else false
          end
          and draft_payload ->> 'reportKind' in (
            'Midterm / Continuous Assessment',
            'End-of-Term / Year Report Card'
          )
          and imported_result_ids is not null
          and cardinality(imported_result_ids) > 0
          and cardinality(imported_result_ids) = jsonb_array_length(draft_payload -> 'items')
        )
      ) not valid;
  end if;
end;
$$;

alter table public.result_import_review_drafts
  validate constraint result_import_review_drafts_completed_entry_integrity_check;
notify pgrst, 'reload schema';
