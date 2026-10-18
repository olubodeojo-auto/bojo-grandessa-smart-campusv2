# Database Schema

Purpose

Document the implementation database used by Grandessa Smart Campus.

This document should contain:

- Current tables
- Relationships
- Foreign keys
- Active migrations
- Database conventions

Rules

- Database changes must be implemented through migrations.
- Update this document after structural database changes.
- Do not document experimental tables.

Current Status

The migration history includes
`20260908000000_parent_portal_child_scoping.sql`, which scopes parent access
through linked students. The supplied live catalog output showed that
`public.report_cards` is currently absent, so report-card RLS does not yet exist
in that database. The Result Access Code flow remains a legacy fallback.

The un-applied results workflow migration in
`supabase/migrations/20261014000000_results_workflow_and_assessment_types.sql`
defines the intended result lifecycle as Draft → Submitted → Published, with
administrator return and teacher resubmission. It retains `Approved` only for
legacy rows and does not rewrite historical statuses. New submissions snapshot
the submitter's display name for the staff audit view. Parents can read linked
children's `Published` and legacy `Approved` results.

The application uses `CA` for Midterm and `Combined` for End-of-Term. Midterm
rows may have an optional `maximum_score`; they do not generate final totals,
grades, or end-of-term report-card metrics. The pending workflow migration adds
the class, subject, and teacher display-name columns when they are absent. It
does not infer assessment types or match class/subject names; it stops if rows
exist so those records can be mapped explicitly. The migration and UI changes
have not been applied to a database. Verify the live schema, policies,
functions, triggers, grants, and migration registry before any deployment; the
checked-in migration history is not proof of the live database state.

Teacher result access in the pending workflow migration is based on
`classes.class_teacher_id` and the student's current class. The migration does
not create or modify the separate teacher-assignment table. The pending
`20261016000000_report_card_details.sql` migration creates `public.report_cards`
when absent and stores per-report-type presentation
details, including calculation mode, summary values, attendance, comments,
dates, and a class-teacher name snapshot. Its school key references
`school_settings.school_id`; its term key references `terms.id`. Parents may
read a saved report only when linked to the pupil and matching published
results exist. The report-card migration adds a unique
school/pupil/class/year/term/report-type key and stops if duplicate identities
exist; class average remains school-entered and is not calculated from other
pupils' marks. The session setup boundary maps the application's First,
Second, and Third labels to the stored `First Term`, `Second Term`, and
`Third Term` names. Report-card term resolution uses that stored name while
report and result records retain the application's short term label. The
pending report migration also provides an authenticated, RLS-respecting
transaction for saving one pupil's imported subject rows and report-card
details together; an error in either write rolls back that pupil's import.

The pending `20261017000000_result_import_review_drafts.sql` migration stores
per-user pupil review drafts separately from operational result rows and report
cards. Draft payloads retain reviewed pupil/subject selections and entered
values, keyed to the workbook contents and worksheet, and are restored when
that workbook is reviewed again. The pending
`20261018000000_list_result_import_review_workbooks.sql` migration adds an
owner-scoped RPC that lists a user's saved workbook keys and pupil-entry counts,
allowing review to resume without uploading the workbook again. Access is
provided through owner-scoped RPCs; direct table grants are revoked, and these
migrations do not enable or change RLS. Drafts are retained when a user changes
tabs, navigates away, or refreshes; deletion is explicit. Final imports
continue to save one pupil at a time through the report-card transaction above.

The verified academic-period schema uses `academic_sessions.session_name` and
`terms.term_name`/`terms.academic_session_id`; terms reference
`academic_sessions.id`. The pending
`20261015000000_academic_session_term_admin_access.sql` migration enables
authenticated reads and limits session/term mutations to administrators through
RLS. Its administrator workflow stores user-entered session and First, Second,
and Third term dates, checks ordering and overlap, and maintains current flags
atomically. It does not infer dates from `academic_calendar`, which remains a
separate display/attendance configuration. Correcting a session name updates
matching `results.academic_year` and, when present, `report_cards.academic_year`
in the same transaction; administrators can correct sessions marked locked.
Workbook previews inspect every worksheet and its internal period headings;
when a worksheet contains multiple term sections, import is restricted to the
requested term section.

Report-card presentation records can be edited or deleted independently of the
subject results that supply their marks. Subject-result corrections and
deletions remain in the results workflow under its existing administrator and
class-teacher permissions.

The October academic-session, results-workflow, and report-card migrations
remain unapplied. The results workflow migration
requires an empty results table before adding assessment-type fields; existing
rows require an explicit verified mapping rather than an inferred assessment
type or class/subject match. Verify the live schema, policies, functions,
triggers, grants, and migration registry before any deployment; checked-in
migrations are not proof of live database state.

## Migration reconciliation audit
See [Migration Reconciliation Audit](MIGRATION_RECONCILIATION_AUDIT_2026-10-18.md) for the 2026-10-18 production/local migration history reconciliation, dry-run evidence, preserved backup locations, and remaining application-validation boundary.
