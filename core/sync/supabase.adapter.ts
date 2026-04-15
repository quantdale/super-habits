import { getDatabase } from "@/core/db/client";
import type { SyncAdapter, SyncRecord } from "@/core/sync/sync.engine";
import { supabase } from "@/lib/supabase";

/** SQLite table names that are enqueued for sync — must match `syncEngine.enqueue` entity strings. */
const SYNCABLE_ENTITIES = [
  "todos",
  "habits",
  "calorie_entries",
  "workout_routines",
] as const;

type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

const SYNCABLE_TABLES = new Set<string>(SYNCABLE_ENTITIES);

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

function isSyncableEntity(entity: string): entity is SyncableEntity {
  return SYNCABLE_TABLES.has(entity);
}

export class SupabaseSyncAdapter implements SyncAdapter {
  async push(records: SyncRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (!supabase) return;

    const db = await getDatabase();
    const byEntity = collectIdsByEntity(records);

    for (const [entity, idSet] of byEntity) {
      if (!isSyncableEntity(entity)) {
        throw new Error(`[sync] Unknown entity in queue: ${entity}`);
      }

      const ids = [...idSet];
      if (ids.length === 0) continue;

      const placeholders = ids.map(() => "?").join(", ");
      const sql = `SELECT * FROM ${entity} WHERE id IN (${placeholders})`;

      const rows = await db.getAllAsync<Record<string, unknown>>(sql, ids);
      const selectedIds = new Set(
        rows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
      );
      const missingIds = ids.filter((id) => !selectedIds.has(id));

      if (missingIds.length > 0) {
        throw new Error(
          `[sync] Missing local rows for ${entity}: ${missingIds.join(", ")}`,
        );
      }

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
