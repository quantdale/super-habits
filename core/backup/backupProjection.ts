/**
 * Import only fields certified by the resolved scope's checksums. A newer
 * mutable server can add columns to historical rows without certifying them;
 * those values must not silently become restored state. Validate rows and
 * verify their scope-specific integrity before calling this projection.
 */
export function projectCertifiedBackupRows<Entity extends string>(
  rowsByEntity: Partial<Record<Entity, readonly Record<string, unknown>[]>>,
  entities: readonly Entity[],
  columns: Readonly<Record<NoInfer<Entity>, readonly string[]>>,
): Partial<Record<Entity, Record<string, unknown>[]>> {
  const projected: Partial<Record<Entity, Record<string, unknown>[]>> = {};
  for (const entity of entities) {
    projected[entity] = (rowsByEntity[entity] ?? []).map((row) =>
      Object.fromEntries(
        columns[entity]
          .filter((column) => row[column] !== undefined)
          .map((column) => [column, row[column]]),
      ),
    );
  }
  return projected;
}
