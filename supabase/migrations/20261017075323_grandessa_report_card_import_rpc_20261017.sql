create or replace function public.save_imported_report_card(
  target_school_id uuid,
  result_updates jsonb,
  result_inserts jsonb,
  report_details jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  d record;
  x record;
  sid uuid;
  tid uuid;
  n integer;
  affected integer;
begin
  if jsonb_typeof(result_updates) <> 'array'
     or jsonb_typeof(result_inserts) <> 'array'
     or jsonb_typeof(report_details) <> 'object' then
    raise exception 'Imported results and report details have an invalid request shape.';
  end if;

  select school_id into sid from public.school_settings where school_id=target_school_id;
  if sid is null then raise exception 'School settings are required before importing report cards.'; end if;

  for x in select * from jsonb_to_recordset(result_updates) as z(
    id uuid, student_id uuid, class_id uuid, subject_id uuid, teacher_id uuid,
    class_name text, subject_name text, teacher_name text, academic_year text, term text,
    assessment_type text, calculation_mode text, continuous_assessment numeric,
    maximum_score numeric, examination numeric, total_score numeric, grade text, remark text
  ) loop
    update public.results r set
      student_id=x.student_id, class_id=x.class_id, subject_id=x.subject_id,
      teacher_id=x.teacher_id, class_name=x.class_name, subject_name=x.subject_name,
      teacher_name=x.teacher_name, academic_year=x.academic_year, term=x.term,
      assessment_type=x.assessment_type, calculation_mode=x.calculation_mode,
      continuous_assessment=x.continuous_assessment, maximum_score=x.maximum_score,
      examination=x.examination, total_score=x.total_score, grade=x.grade,
      remark=x.remark, updated_at=now()
    where r.id=x.id;
    get diagnostics affected=row_count;
    if affected <> 1 then raise exception 'A selected result no longer exists. Reload the workbook and try again.'; end if;
  end loop;

  insert into public.results (
    student_id,class_id,subject_id,teacher_id,class_name,subject_name,teacher_name,
    academic_year,term,assessment_type,calculation_mode,continuous_assessment,
    maximum_score,examination,total_score,grade,remark,status,created_by
  )
  select z.student_id,z.class_id,z.subject_id,z.teacher_id,z.class_name,z.subject_name,z.teacher_name,
    z.academic_year,z.term,z.assessment_type,z.calculation_mode,z.continuous_assessment,
    z.maximum_score,z.examination,z.total_score,z.grade,z.remark,'Draft',auth.uid()
  from jsonb_to_recordset(result_inserts) as z(
    student_id uuid,class_id uuid,subject_id uuid,teacher_id uuid,class_name text,
    subject_name text,teacher_name text,academic_year text,term text,assessment_type text,
    calculation_mode text,continuous_assessment numeric,maximum_score numeric,
    examination numeric,total_score numeric,grade text,remark text
  );

  select * into d from jsonb_to_record(report_details) as z(
    student_id uuid,class_id uuid,academic_year text,term text,report_type text,
    calculation_mode text,class_teacher_name text,class_teacher_comment text,
    head_teacher_comment text,class_average numeric,total_marks_obtained numeric,
    total_marks_obtainable numeric,student_percentage numeric,maximum_attendance integer,
    times_present integer,times_absent integer,term_ending text,next_term_begins text
  );

  if d.report_type not in ('Midterm','End-of-Term') then raise exception 'Unsupported report type.'; end if;
  if not exists(select 1 from public.students s where s.id=d.student_id and s.class_id=d.class_id) then
    raise exception 'Selected pupil does not belong to the selected class.'; end if;

  if exists (
    select 1 from jsonb_to_recordset(result_inserts) as z(student_id uuid,class_id uuid,academic_year text,term text,assessment_type text)
    where z.student_id is distinct from d.student_id or z.class_id is distinct from d.class_id
      or z.academic_year is distinct from d.academic_year or z.term is distinct from d.term
      or (d.report_type='Midterm' and z.assessment_type <> 'CA')
      or (d.report_type='End-of-Term' and z.assessment_type not in ('Combined','Examination'))
  ) then raise exception 'Imported result rows do not match the selected pupil, class, period, or report type.'; end if;

  select count(*) into n from public.terms t join public.academic_sessions s on s.id=t.academic_session_id
    where t.term_name=d.term || ' Term' and s.session_name=d.academic_year;
  if n <> 1 then raise exception 'The selected academic session and term must resolve to exactly one saved term.'; end if;
  select t.id into tid from public.terms t join public.academic_sessions s on s.id=t.academic_session_id
    where t.term_name=d.term || ' Term' and s.session_name=d.academic_year;

  insert into public.report_cards (
    school_id,student_id,class_id,term_id,academic_year,term,report_type,calculation_mode,
    class_teacher_name,class_teacher_comment,head_teacher_comment,class_average,
    total_marks_obtained,total_marks_obtainable,student_percentage,maximum_attendance,
    times_present,times_absent,term_ending,next_term_begins
  ) values (
    sid,d.student_id,d.class_id,tid,d.academic_year,d.term,d.report_type,d.calculation_mode,
    d.class_teacher_name,d.class_teacher_comment,d.head_teacher_comment,d.class_average,
    d.total_marks_obtained,d.total_marks_obtainable,d.student_percentage,d.maximum_attendance,
    d.times_present,d.times_absent,nullif(d.term_ending,'')::date,nullif(d.next_term_begins,'')::date
  )
  on conflict (school_id,student_id,class_id,academic_year,term,report_type) do update set
    term_id=excluded.term_id,calculation_mode=excluded.calculation_mode,
    class_teacher_name=excluded.class_teacher_name,class_teacher_comment=excluded.class_teacher_comment,
    head_teacher_comment=excluded.head_teacher_comment,class_average=excluded.class_average,
    total_marks_obtained=excluded.total_marks_obtained,total_marks_obtainable=excluded.total_marks_obtainable,
    student_percentage=excluded.student_percentage,maximum_attendance=excluded.maximum_attendance,
    times_present=excluded.times_present,times_absent=excluded.times_absent,
    term_ending=excluded.term_ending,next_term_begins=excluded.next_term_begins,updated_at=now();
end;
$$;
revoke all on function public.save_imported_report_card(uuid,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_imported_report_card(uuid,jsonb,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
