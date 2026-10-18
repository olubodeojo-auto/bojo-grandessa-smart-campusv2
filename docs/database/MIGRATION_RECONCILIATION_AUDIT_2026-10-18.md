# Grandessa Smart Campus — Migration Reconciliation Audit

**Close-out date:** 2026-10-18 06:05:13 +01:00
**Production Supabase project ref:** `cycnwkxxbvkrpxvkgxfd`
**Project root:** `C:\Users\user\Desktop\Grandessa-Smart-Campus\Website`
**Scope:** migration history reconciliation, preservation of prior work, warning cleanup, and evidence capture. This report does not claim the application workflow has passed end-to-end UI testing.

## Executive status

- Local and remote migration histories were compared after cleanup: **32 version rows; every parsed local version matched the corresponding remote version**.
- `npx supabase db push --linked --dry-run` completed with exit code 0 and did not list a migration SQL file to push. **No actual database push, reset, or production data deletion was run.**
- Four malformed backup artifacts were archived outside `supabase/migrations` after SHA-256 verification against the preserved `supabase` snapshot.
- Existing application source changes were not staged, committed, reverted, or removed by this finalization. The pre-finalization Git status is recorded below for context.

## What happened on 2026-10-18

1. Earlier reconciliation attempts stopped safely while parsing Supabase CLI output. They created backups/logs but did not change migration files or migration history during those failed attempts.
2. The successful v3 reconciliation verified the production project ref and production schema, restored the exact SQL body from the production migration registry for 11 migration versions, removed the exact blanket existing-results guard from the local 20261014 migration, aligned the local publish-result and workbook-listing migration SQL with the deployed registry bodies, and reconciled local history for six migrations.
3. `npx supabase migration list --linked` subsequently displayed matching Local and Remote versions. This finalization ran the history comparison again and captured the actual output below.
4. A dry-run was used for pending-migration verification. No actual `db push` was issued.
5. Old reconciliation logs and the four migration backup artifacts were moved into the finalization archive. Their contents were preserved; the full backup snapshot remains at `C:/Users/user/Desktop/Grandessa-Smart-Campus/Website/migration-reconciliation-backup-20261018-054827`.

## Production state recorded during direct read-only checks

| Check | Observed value |
|---|---:|
| Migration registry records | 32 |
| Results rows | 13 |
| Published results | 12 |
| Draft results | 1 |
| Results missing checked workflow fields (`assessment_type`, `class_id`, `subject_id`, `teacher_id`) | 0 |
| Report cards | 1 |
| `activity_logs` rows | 492 |
| `result_change_log` rows before and after rollback-only trigger test | 0 |
| Workflow/access helper functions checked | 8 present |
| Policies across results, report cards, academic sessions, and terms | 14 present |
| Relevant triggers on results/report_cards/academic_sessions/terms | 6 present |

The `result_change_log` table and `trg_results_audit_changes` trigger were present and the trigger calls `audit_result_changes()`. A rollback-only update test using the assigned teacher identity returned without error; subsequent read-only checks confirmed the draft result remained unchanged, results remained at 13, and `result_change_log` remained at zero. The test left no permanent test update or test audit row. Do not insert fake audit events or purge existing activity logs. Validate this trigger with a genuine authorised result edit during application testing.

## Malformed backup files archived from `supabase/migrations`

- 20261014000000_results_workflow_and_assessment_types.sql.bak-20261016-192554
- 20261014000000_results_workflow_and_assessment_types.sql.before-rls-removal.bak
- 20261015000000_academic_session_term_admin_access.sql.before-rls-removal.bak
- 20261016000000_report_card_details.sql.before-rls-removal.bak

Archive folder: `C:/Users/user/Desktop/Grandessa-Smart-Campus/Website/migration-reconciliation-backup-20261018-054827/finalization-20261018\skipped-migration-backups`
The exact original files are also preserved in the full snapshot under `C:/Users/user/Desktop/Grandessa-Smart-Campus/Website/migration-reconciliation-backup-20261018-054827\supabase\migrations`.

## Migration version comparison

| Local version | Remote version | Result |
|---|---|---|
| 20260719121850 | 20260719121850 | MATCH |
| 20260721103000 | 20260721103000 | MATCH |
| 20260722123000 | 20260722123000 | MATCH |
| 20260813000000 | 20260813000000 | MATCH |
| 20260814000000 | 20260814000000 | MATCH |
| 20260814000001 | 20260814000001 | MATCH |
| 20260827000000 | 20260827000000 | MATCH |
| 20260831000000 | 20260831000000 | MATCH |
| 20260903000000 | 20260903000000 | MATCH |
| 20260906000000 | 20260906000000 | MATCH |
| 20260906000001 | 20260906000001 | MATCH |
| 20260908000000 | 20260908000000 | MATCH |
| 20260908000001 | 20260908000001 | MATCH |
| 20260908000002 | 20260908000002 | MATCH |
| 20260909000000 | 20260909000000 | MATCH |
| 20261014000000 | 20261014000000 | MATCH |
| 20261015000000 | 20261015000000 | MATCH |
| 20261016000000 | 20261016000000 | MATCH |
| 20261017000000 | 20261017000000 | MATCH |
| 20261017000001 | 20261017000001 | MATCH |
| 20261017075303 | 20261017075303 | MATCH |
| 20261017075323 | 20261017075323 | MATCH |
| 20261017075328 | 20261017075328 | MATCH |
| 20261017083603 | 20261017083603 | MATCH |
| 20261017130448 | 20261017130448 | MATCH |
| 20261017184748 | 20261017184748 | MATCH |
| 20261017221948 | 20261017221948 | MATCH |
| 20261017224931 | 20261017224931 | MATCH |
| 20261017225037 | 20261017225037 | MATCH |
| 20261017225107 | 20261017225107 | MATCH |
| 20261017225324 | 20261017225324 | MATCH |
| 20261018000000 | 20261018000000 | MATCH |

## Final Supabase migration-list output

```text
Initialising login role...
Connecting to remote database...


   Local            | Remote           | Time (UTC)
  ------------------|------------------|-----------------------
   `20260719121850` | `20260719121850` | `2026-07-19 12:18:50`
   `20260721103000` | `20260721103000` | `2026-07-21 10:30:00`
   `20260722123000` | `20260722123000` | `2026-07-22 12:30:00`
   `20260813000000` | `20260813000000` | `2026-08-13 00:00:00`
   `20260814000000` | `20260814000000` | `2026-08-14 00:00:00`
   `20260814000001` | `20260814000001` | `2026-08-14 00:00:01`
   `20260827000000` | `20260827000000` | `2026-08-27 00:00:00`
   `20260831000000` | `20260831000000` | `2026-08-31 00:00:00`
   `20260903000000` | `20260903000000` | `2026-09-03 00:00:00`
   `20260906000000` | `20260906000000` | `2026-09-06 00:00:00`
   `20260906000001` | `20260906000001` | `2026-09-06 00:00:01`
   `20260908000000` | `20260908000000` | `2026-09-08 00:00:00`
   `20260908000001` | `20260908000001` | `2026-09-08 00:00:01`
   `20260908000002` | `20260908000002` | `2026-09-08 00:00:02`
   `20260909000000` | `20260909000000` | `2026-09-09 00:00:00`
   `20261014000000` | `20261014000000` | `2026-10-14 00:00:00`
   `20261015000000` | `20261015000000` | `2026-10-15 00:00:00`
   `20261016000000` | `20261016000000` | `2026-10-16 00:00:00`
   `20261017000000` | `20261017000000` | `2026-10-17 00:00:00`
   `20261017000001` | `20261017000001` | `2026-10-17 00:00:01`
   `20261017075303` | `20261017075303` | `2026-10-17 07:53:03`
   `20261017075323` | `20261017075323` | `2026-10-17 07:53:23`
   `20261017075328` | `20261017075328` | `2026-10-17 07:53:28`
   `20261017083603` | `20261017083603` | `2026-10-17 08:36:03`
   `20261017130448` | `20261017130448` | `2026-10-17 13:04:48`
   `20261017184748` | `20261017184748` | `2026-10-17 18:47:48`
   `20261017221948` | `20261017221948` | `2026-10-17 22:19:48`
   `20261017224931` | `20261017224931` | `2026-10-17 22:49:31`
   `20261017225037` | `20261017225037` | `2026-10-17 22:50:37`
   `20261017225107` | `20261017225107` | `2026-10-17 22:51:07`
   `20261017225324` | `20261017225324` | `2026-10-17 22:53:24`
   `20261018000000` | `20261018000000` | `2026-10-18 00:00:00`

```

## Final dry-run output

Result: **PASS: exit code 0; no pending migration SQL file was listed; no push executed.**

```text
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Remote database is up to date.
A new version of Supabase CLI is available: v2.121.0 (currently installed v2.109.1)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

## Pre-finalization Git status

These are the worktree entries reported before this finalization added the audit document and archived generated logs/backup files. This cleanup did not change, stage, commit, or revert these application edits.

```text
 M docs/database/DATABASE_SCHEMA.md
 M package-lock.json
 M package.json
 M src/components/modals/AppModal.tsx
 M src/components/reports/ReportCardDocument.tsx
 M src/config/grandessaGrading.ts
 M src/config/routeRoles.ts
 M src/pages/admin/results/ReportCardsPage.tsx
 M src/pages/admin/results/ResultFilters.tsx
 M src/pages/admin/results/ResultForm.tsx
 M src/pages/admin/results/ResultTable.tsx
 M src/pages/admin/results/ResultTableGrouped.tsx
 M src/pages/admin/results/ResultsPage.tsx
 M src/pages/admin/students/StudentForm.tsx
 M src/pages/portal/ParentReportsPage.tsx
 M src/services/reportCardService.ts
 M src/services/resultImportService.ts
 M src/services/resultService.ts
 M src/services/studentService.ts
 M src/services/subjectService.ts
 M src/types/reportCard.ts
 M src/types/result.ts
 M src/types/student.ts
 M src/types/subject.ts
 M src/utils/resultCalculations.ts
 M tsconfig.app.json
?? migration-reconciliation-backup-20261017-232253/
?? migration-reconciliation-backup-20261018-000917/
?? migration-reconciliation-backup-20261018-002035/
?? migration-reconciliation-backup-20261018-054456/
?? migration-reconciliation-backup-20261018-054827/
?? src/pages/admin/results/ResultBatchEntry.tsx
?? src/pages/admin/results/ResultsNotificationBell.tsx
?? src/services/academicSessionService.ts
?? src/services/resultServicePublishing.test.ts
?? src/services/resultsWorkflow.test.ts
?? src/types/academicSession.ts
?? src/utils/academicSessionValidation.ts
?? src/utils/reportCalculations.ts
?? src/utils/reportCardPresentation.ts
?? src/utils/reportCenter.ts
?? src/utils/reportTermResolution.ts
?? src/utils/resultDraftRecovery.ts
?? src/utils/resultPermissions.ts
?? src/utils/resultPresentation.ts
?? src/utils/scoreInput.ts
?? supabase/migrations/20261014000000_results_workflow_and_assessment_types.sql
?? supabase/migrations/20261014000000_results_workflow_and_assessment_types.sql.bak-20261016-192554
?? supabase/migrations/20261014000000_results_workflow_and_assessment_types.sql.before-rls-removal.bak
?? supabase/migrations/20261015000000_academic_session_term_admin_access.sql
?? supabase/migrations/20261015000000_academic_session_term_admin_access.sql.before-rls-removal.bak
?? supabase/migrations/20261016000000_report_card_details.sql
?? supabase/migrations/20261016000000_report_card_details.sql.before-rls-removal.bak
?? supabase/migrations/20261017000000_result_import_review_drafts.sql
?? supabase/migrations/20261017000001_publish_result_rpc.sql
?? supabase/migrations/20261017075303_grandessa_import_schema_compatibility_20261017.sql
?? supabase/migrations/20261017075323_grandessa_report_card_import_rpc_20261017.sql
?? supabase/migrations/20261017075328_grandessa_seed_workbook_academic_period_20261017.sql
?? supabase/migrations/20261017083603_result_import_review_drafts.sql
?? supabase/migrations/20261017130448_fix_result_import_review_workbook_listing.sql
?? supabase/migrations/20261017184748_publish_result_rpc_compatibility.sql
?? supabase/migrations/20261017221948_restore_academic_session_and_report_term_helpers_20261018.sql
?? supabase/migrations/20261017224931_results_workflow_existing_data_reconciliation_20261018.sql
?? supabase/migrations/20261017225037_report_card_details_existing_schema_reconciliation_20261018.sql
?? supabase/migrations/20261017225107_academic_session_admin_access_existing_schema_reconciliation_20261018.sql
?? supabase/migrations/20261017225324_route_legacy_publish_rpc_through_result_lifecycle_20261018.sql
?? supabase/migrations/20261018000000_list_result_import_review_workbooks.sql
```

**Interpretation:** database migration history is reconciled and the filename-warning cleanup is complete. The application code edits shown in the recorded Git status remain uncommitted by design; do not use `git reset`, `git clean`, or indiscriminately commit them. End-to-end results, import/review, publish, report-card, and permissions tests remain a separate application validation task.

## Preserved evidence locations

- Full backup snapshot: `C:/Users/user/Desktop/Grandessa-Smart-Campus/Website/migration-reconciliation-backup-20261018-054827\supabase`
- Finalization archive: `C:/Users/user/Desktop/Grandessa-Smart-Campus/Website/migration-reconciliation-backup-20261018-054827/finalization-20261018`
- Finalization run log: `migration-reconciliation-backup-20261018-054827/finalization-20261018/finalization-run.log`
