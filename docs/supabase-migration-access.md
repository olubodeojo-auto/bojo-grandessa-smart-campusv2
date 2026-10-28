# Supabase migration access requirements

For each migration that creates a table in `public`, explicitly choose the table's access model in the same migration. Do not rely on platform defaults for new tables.

- Private school data should not be made public. Use row-level security (RLS) and policies for direct client access.
- If the table is accessed only through carefully authorized database functions, document that RPC-only design in a comment and do not give browser roles direct table access.
- If RLS is intentionally disabled, document the reason and compensating controls.
- Include explicit table-level privilege decisions. Grant only the operations needed by the intended role; never blanket-grant all public tables.
- SECURITY DEFINER functions must validate the caller and requested school/class/record, use a fixed safe search path, and have execute rights limited to intended roles.
- This guard applies to changed/new migrations. It does not fix the existing RLS-disabled tables or change production permissions.

CI checks newly changed migration files that create public tables for an explicit RLS/access decision and explicit table privileges. Treat it as a guardrail, not a substitute for SQL review and a test migration against a disposable database.
