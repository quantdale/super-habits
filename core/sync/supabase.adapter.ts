import { getDatabase } from "@/core/db/client";
import type { SyncAdapter, SyncRecord } from "@/core/sync/sync.engine";
import { supabase } from "@/lib/supabase";

/** SQLite table names that are enqueued for sync — must match `syncEngine.enqueue` entity strings. */
const SYNCABLE_TABLES = new Set([
  "todos",
  "habits",
  "calorie_entries",
  "workout_routines",
]);

function collectIdsByEntity(records: SyncRecord[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of records) {
    let set = map.get(r.entity);
    if (!set) {
      set = new Set();
      map.set(r.entity, set);
    }
    set.add(r.id);
  }
  return map;
}

export class SupabaseSyncAdapter implements SyncAdapter {
  async push(records: SyncRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (!supabase) return;

    const db = await getDatabase();
    const byEntity = collectIdsByEntity(records);

    for (const [entity, idSet] of byEntity) {
      if (!SYNCABLE_TABLES.has(entity)) {
        console.warn(`[sync] skip unknown entity: ${entity}`);
        continue;
      }

      const ids = [...idSet];
      if (ids.length === 0) continue;

      const placeholders = ids.map(() => "?").join(", ");
      const sql = `SELECT * FROM ${entity} WHERE id IN (${placeholders})`;

      const rows = await db.getAllAsync<Record<string, unknown>>(sql, ids);
      if (rows.length === 0) continue;

      const { error } = await supabase.from(entity).upsert(rows, {
        onConflict: "id",
      });

      if (error) {
        throw new Error(`[sync] Supabase upsert failed for ${entity}: ${error.message}`);
      }
    }
  }

  async pull(_since: string | null): Promise<SyncRecord[]> {
    return [];
  }
}
