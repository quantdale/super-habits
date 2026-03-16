# fix-ui

Fix a UI, screen, or domain logic issue in SuperHabits. Plan-first via feature-agent.

---

Use feature-agent subagent.
Apply feature-module-pattern and rn-expo-conventions skills.

Issue: {{issue}}

Workflow:
1. Read all affected Screen and domain files.
2. Read the corresponding .data.ts for the data API (do not modify it).
3. Identify root cause precisely (file + line).
4. Write plan: files to change, exact changes.
5. Wait for approval.
6. Implement.
7. Run npm run typecheck, npm test.
8. Report: root cause, fix, test count.

Hard constraints:
- No direct DB imports in Screen or domain files
- New domain functions need Vitest tests
- Use FlashList not FlatList
- Use NativeWind className not StyleSheet.create
- Do not wire up zustand or React Query without explicit instruction
- Do not silently fix toDateKey() UTC bug
