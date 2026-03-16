# fix-data

Fix a data layer issue (SQLite, migration, *.data.ts, types). Plan-first via data-agent.

---

Use data-agent subagent.
Apply db-and-sync-invariants skill.

Issue: {{issue}}

Workflow:
1. Read all affected files in core/db/ and features/*/data.ts.
2. Identify root cause precisely (file + line).
3. Write plan: files to change, exact changes.
4. Wait for approval.
5. Implement.
6. Run npm run typecheck, npm test.
7. Report: root cause, fix, test count.

Hard constraints:
- Soft delete only
- syncEngine.enqueue() on every applicable write
- createId() for all IDs
- New columns require new migration
- Do not touch Screen or domain files (use /fix-ui for that)
