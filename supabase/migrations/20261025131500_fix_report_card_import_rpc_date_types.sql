-- Fix the import RPC's JSON record types to match the report_cards date columns.
-- This fixes a production blocker for otherwise valid imported results.
CREATE OR REPLACE FUNCTION public.save_imported_report_card(target_school_id uuid, result_updates jsonb, result_inserts jsonb, report_details jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  result_update record;
  report_row record;
  current_school_id uuid;
  resolved_term_id uuid;
  matching_terms integer;
  affected_rows integer;
begin
  if coalesce(jsonb_typeof(result_updates), '') <> 'array'
    or coalesce(jsonb_typeof(result_inserts), '') <> 'array'
    or coalesce(jsonb_typeof(report_details), '') <> 'object'
  then
    raise exception 'Imported results and report details have an invalid request shape.';
  end if;

  select school_id into current_school_id
  from public.school_settings
  where school_id = target_school_id;
  if current_school_id is null then
    raise exception 'School settings are required before importing report cards.';
  end if;

  for result_update in
    select * from jsonb_to_recordset(result_updates) as row_data(
      id uuid,
      student_id uuid,
      class_id uuid,
      subject_id uuid,
      teacher_id uuid,
      class_name text,
      subject_name text,
      teacher_name text,
      academic_year text,
      term text,
      assessment_type text,
      calculation_mode text,
      continuous_assessment numeric,
      maximum_score numeric,
      examination numeric,
      total_score numeric,
      grade text,
      remark text
    )
  loop
    update public.results r
    set student_id = result_update.student_id,
        class_id = result_update.class_id,
        subject_id = result_update.subject_id,
        teacher_id = result_update.teacher_id,
        class_name = result_update.class_name,
        subject_name = result_update.subject_name,
        teacher_name = result_update.teacher_name,
        academic_year = result_update.academic_year,
        term = result_update.term,
        assessment_type = result_update.assessment_type,
        calculation_mode = result_update.calculation_mode,
        continuous_assessment = result_update.continuous_assessment,
        maximum_score = result_update.maximum_score,
        examination = result_update.examination,
        total_score = result_update.total_score,
        grade = result_update.grade,
        remark = result_update.remark,
        updated_at = now()
    where r.id = result_update.id;
    get diagnostics affected_rows = row_count;
    if affected_rows <> 1 then
      raise exception 'A selected result no longer exists. Reload the workbook and try again.';
    end if;
  end loop;

  insert into public.results (
    student_id, class_id, subject_id, teacher_id, class_name, subject_name,
    teacher_name, academic_year, term, assessment_type, calculation_mode,
    continuous_assessment, maximum_score, examination, total_score, grade,
    remark, status, created_by
  )
  select row_data.student_id, row_data.class_id, row_data.subject_id,
    row_data.teacher_id, row_data.class_name, row_data.subject_name,
    row_data.teacher_name, row_data.academic_year, row_data.term,
    row_data.assessment_type, row_data.calculation_mode,
    row_data.continuous_assessment, row_data.maximum_score, row_data.examination,
    row_data.total_score, row_data.grade, row_data.remark, 'Draft', auth.uid()
  from jsonb_to_recordset(result_inserts) as row_data(
    student_id uuid,
    class_id uuid,
    subject_id uuid,
    teacher_id uuid,
    class_name text,
    subject_name text,
    teacher_name text,
    academic_year text,
    term text,
    assessment_type text,
    calculation_mode text,
    continuous_assessment numeric,
    maximum_score numeric,
    examination numeric,
    total_score numeric,
    grade text,
    remark text
  );

  select * into report_row
  from jsonb_to_record(report_details) as row_data(
    student_id uuid,
    class_id uuid,
    academic_year text,
    term text,
    report_type text,
    calculation_mode text,
    class_teacher_name text,
    class_teacher_comment text,
    head_teacher_comment text,
    class_average numeric,
    total_marks_obtained numeric,
    total_marks_obtainable numeric,
    student_percentage numeric,
    maximum_attendance integer,
    times_present integer,
    times_absent integer,
    term_ending date,
    next_term_begins date
  );

  if report_row.report_type is null
    or report_row.report_type not in ('Midterm', 'End-of-Term')
  then
    raise exception 'The report type must be Midterm or End-of-Term.';
  end if;

  if not exists (
    select 1
    from public.students s
    where s.id = report_row.student_id
      and s.class_id = report_row.class_id
  ) then
    raise exception 'The selected pupil must be assigned to the report-card class.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(result_updates || result_inserts) imported(row_data)
    left join public.classes c on c.id::text = imported.row_data ->> 'class_id'
    where imported.row_data ->> 'student_id' is distinct from report_row.student_id::text
      or imported.row_data ->> 'class_id' is distinct from report_row.class_id::text
      or imported.row_data ->> 'academic_year' is distinct from report_row.academic_year
      or imported.row_data ->> 'term' is distinct from report_row.term
      or c.id is null
      or imported.row_data ->> 'teacher_id' is distinct from c.class_teacher_id::text
      or (
        report_row.report_type = 'Midterm'
        and imported.row_data ->> 'assessment_type' is distinct from 'CA'
      )
      or (
        report_row.report_type = 'End-of-Term'
        and (
          imported.row_data ->> 'assessment_type' is null
          or imported.row_data ->> 'assessment_type' not in ('Combined', 'Examination')
        )
      )
  ) then
    raise exception 'Imported results must match the selected pupil, class, session, term, assigned teacher, and report type.';
  end if;

  select count(*) into matching_terms
  from public.terms t
  join public.academic_sessions s on s.id = t.academic_session_id
  where t.term_name = report_row.term || ' Term'
    and s.session_name = report_row.academic_year;
  if matching_terms <> 1 then
    raise exception 'The selected academic session and term must resolve to exactly one saved term.';
  end if;
  select t.id into resolved_term_id
  from public.terms t
  join public.academic_sessions s on s.id = t.academic_session_id
  where t.term_name = report_row.term || ' Term'
    and s.session_name = report_row.academic_year;

  insert into public.report_cards (
    school_id, student_id, class_id, term_id, academic_year, term, report_type,
    calculation_mode, class_teacher_name, class_teacher_comment,
    head_teacher_comment, class_average, total_marks_obtained,
    total_marks_obtainable, student_percentage, maximum_attendance,
    times_present, times_absent, term_ending, next_term_begins
  )
  values (
    current_school_id, report_row.student_id, report_row.class_id,
    resolved_term_id, report_row.academic_year, report_row.term,
    report_row.report_type, report_row.calculation_mode,
    report_row.class_teacher_name, report_row.class_teacher_comment,
    report_row.head_teacher_comment, report_row.class_average,
    report_row.total_marks_obtained, report_row.total_marks_obtainable,
    report_row.student_percentage, report_row.maximum_attendance,
    report_row.times_present, report_row.times_absent,
    report_row.term_ending, report_row.next_term_begins
  )
  on conflict (school_id, student_id, class_id, academic_year, term, report_type)
  do update set
    term_id = excluded.term_id,
    calculation_mode = excluded.calculation_mode,
    class_teacher_name = excluded.class_teacher_name,
    class_teacher_comment = excluded.class_teacher_comment,
    head_teacher_comment = excluded.head_teacher_comment,
    class_average = excluded.class_average,
    total_marks_obtained = excluded.total_marks_obtained,
    total_marks_obtainable = excluded.total_marks_obtainable,
    student_percentage = excluded.student_percentage,
    maximum_attendance = excluded.maximum_attendance,
    times_present = excluded.times_present,
    times_absent = excluded.times_absent,
    term_ending = excluded.term_ending,
    next_term_begins = excluded.next_term_begins,
    updated_at = now();
end;
$function$;

revoke all on function public.save_imported_report_card(uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_imported_report_card(uuid,jsonb,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
