import type {
  BackupEntity,
  EntityIntegrityMetadata,
  RecoverableSettingsV2,
} from '@/core/backup/backup.types';

/**
 * Portable Data Export & Import V1 — file contract.
 *
 * A portable backup is ONE self-contained, versioned JSON file that a user
 * controls end-to-end (store, copy, share) and can import onto an eligible
 * EMPTY installation. It is deliberately independent of cloud Backup V2:
 * no Supabase, no Auth, no network required.
 *
 * The portable envelope version (`PORTABLE_BACKUP_FORMAT_VERSION`) is
 * separate from the domain backup schema version
 * (`BACKUP_SCHEMA_VERSION` in `core/backup/backup.types.ts`). A future app
 * distinguishes the two and rejects unsupported values safely.
 */

/** Envelope discriminator; only this exact string identifies a portable file. */
export const PORTABLE_BACKUP_FORMAT = 'superhabits-portable-backup';

/** Current portable envelope version (independent of the domain schema). */
export const PORTABLE_BACKUP_FORMAT_VERSION = 1;

/**
 * Portable V1 file size contract — the SINGLE bound shared by export and
 * import. Every successful V1 export satisfies
 * `utf8Bytes(json).length <= PORTABLE_V1_MAX_BYTES`, and every importer
 * (web and native) rejects files above this bound before loading the full
 * body into memory. Imported files are untrusted: 100 MB is far beyond
 * realistic long-term Super Habits use (years of history fit in a few MB)
 * yet still bounds memory (transiently ~2x file size while reading +
 * parsing).
 */
export const PORTABLE_V1_MAX_BYTES = 100 * 1024 * 1024;

export type PortableSourceInfo = {
  /** App version that produced the file (`Constants.expoConfig.version`). */
  appVersion: string;
  /** `Platform.OS` value of the exporting device. */
  platform: string;
  /**
   * One-way fingerprint of the exporting device's durable dataset owner
   * (SHA-256 of `superhabits-portable-owner-v1:` + owner UUID), or `null`
   * when the source dataset had no durable owner binding (local-only).
   * Compatibility metadata only — never authentication.
   */
  ownerFingerprint: string | null;
};

export type PortableIntegrity = {
  /** Per-entity row count + deterministic SHA-256 (reuse `checksumRows`). */
  entities: Partial<Record<BackupEntity, EntityIntegrityMetadata>>;
  /** Canonical checksum of the recoverable settings payload + contract version. */
  settings: { version: number; checksum: string };
  /**
   * SHA-256 of the documented canonical payload text covering the envelope
   * identity fields, every canonical entity row, and the canonical settings
   * text — excluding `integrity.payloadChecksum` itself (no self-reference).
   */
  payloadChecksum: string;
};

export type PortableBackupFile = {
  format: typeof PORTABLE_BACKUP_FORMAT;
  formatVersion: number;
  backupSchemaVersion: number;
  /** ISO-8601 timestamp of the export moment. */
  exportedAt: string;
  source: PortableSourceInfo;
  /** All 12 recoverable entities; rows are stored sorted by id. */
  entities: Partial<Record<BackupEntity, Record<string, unknown>[]>>;
  /** Recoverable settings allowlist payload (calorie goal, pomodoro, theme). */
  settings: RecoverableSettingsV2;
  integrity: PortableIntegrity;
};

/** Human-readable domain labels for the import preview (no raw table names). */
export const PORTABLE_DOMAIN_LABELS: Record<BackupEntity, string> = {
  todos: 'Todos',
  habits: 'Habits',
  habit_completions: 'Habit history',
  calorie_entries: 'Calorie entries',
  saved_meals: 'Saved meals',
  workout_routines: 'Workout routines',
  routine_exercises: 'Workout exercises',
  routine_exercise_sets: 'Workout sets',
  workout_logs: 'Workout sessions',
  workout_session_exercises: 'Session exercises',
  pomodoro_sessions: 'Focus sessions',
  linked_action_rules: 'Linked action rules',
};

/** Import-eligibility owner verdicts surfaced in the preview. */
export type PortableOwnerVerdict =
  | 'same_owner'
  | 'different_owner'
  | 'adopting_into_owner'
  | 'unclaimed'
  | 'local_only_source'
  | 'no_owner_required';

export type PortableImportEligibility = {
  kind: 'eligible' | 'blocked';
  reason?: 'device_not_empty' | 'owner_mismatch' | 'invalid';
  message: string;
};

export type PortableImportPreview = {
  fileName: string;
  exportedAt: string | null;
  counts: Partial<Record<BackupEntity, number>>;
  totalRows: number;
  settingsIncluded: boolean;
  integrityVerified: boolean;
  ownerVerdict: PortableOwnerVerdict | null;
  ownerMessage: string;
  disclosures: string[];
  warnings: string[];
  eligibility: PortableImportEligibility;
};

export type PortableImportOutcome =
  | {
      status: 'ready';
      preview: PortableImportPreview;
      /** Validated file kept in memory for the explicit confirm step. */
      file: PortableBackupFile;
    }
  | {
      status: 'rejected';
      message: string;
      diagnostics: string[];
    };

export type PortableImportResult =
  | {
      status: 'restored';
      importedAt: string;
      importedCounts: Partial<Record<BackupEntity, number>>;
    }
  | {
      status: 'blocked';
      reason: 'local_data_present' | 'owner_mismatch' | 'invalid';
      message: string;
      diagnostics: string[];
    };
