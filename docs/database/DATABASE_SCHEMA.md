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

The active migration `20260908000000_parent_portal_child_scoping.sql` restricts
parent reads of students, attendance, report cards, results, and assignments to
students linked through `contacts.auth_user_id = auth.uid()`. Staff policies
remain school-scoped. The Result Access Code flow remains a legacy fallback.