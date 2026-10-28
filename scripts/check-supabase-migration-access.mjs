#!/usr/bin/env node
/**
 * Guard newly changed Supabase migrations against creating public tables without
 * an explicit access decision. This is a review guard, not a SQL parser.
 */
import { readFileSync } from "node:fs";

const files = process.argv.slice(2).filter((file) => file.endsWith(".sql"));
let failed = false;

for (const file of files) {
  const sql = readFileSync(file, "utf8");
  const tables = new Set();
  const createTable = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi;
  for (const match of sql.matchAll(createTable)) tables.add(match[1].toLowerCase());

  if (tables.size === 0) continue;
  console.log(`Checking public table access contract: ${file}`);

  for (const table of tables) {
    const tablePattern = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const qualified = `public\\.${tablePattern}`;
    const hasRls = new RegExp(
      `alter\\s+table\\s+(?:if\\s+exists\\s+)?${qualified}\\s+enable\\s+row\\s+level\\s+security`,
      "i",
    ).test(sql);
    const intentionalNoRls = new RegExp(
      `--\\s*RLS intentionally disabled:\\s*${qualified}\\s*[-—:]\\s*\\S+`,
      "i",
    ).test(sql);
    const hasTableAcl = new RegExp(
      `(?:grant|revoke)\\b[\\s\\S]{0,180}?\\bon\\s+(?:table\\s+)?${qualified}\\b`,
      "i",
    ).test(sql);
    const hasPolicy = new RegExp(
      `create\\s+policy\\b[\\s\\S]{0,500}?\\bon\\s+${qualified}\\b`,
      "i",
    ).test(sql);
    const rpcOnly = new RegExp(
      `--\\s*API access is RPC-only for:\\s*${qualified}\\s*[-—:]\\s*\\S+`,
      "i",
    ).test(sql);

    if (!hasRls && !intentionalNoRls) {
      console.error(`FAIL ${file}: public.${table} must enable RLS or include a reasoned "RLS intentionally disabled" comment.`);
      failed = true;
    }
    if (!hasTableAcl) {
      console.error(`FAIL ${file}: public.${table} needs explicit GRANT/REVOKE table privileges in this migration.`);
      failed = true;
    }
    if (hasRls && !hasPolicy && !rpcOnly) {
      console.error(`FAIL ${file}: public.${table} has RLS but no policy; add policies or document RPC-only access.`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Migration access check failed. Keep grants, RLS/policies (or a documented RPC-only design), and table creation together.");
  process.exit(1);
}
console.log("Supabase migration access check passed.");
