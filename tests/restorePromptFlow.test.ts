import { describe, expect, it } from "vitest";
import { resolveRestorePromptOutcome } from "@/core/providers/restorePromptFlow";
import type { RestorePreview, SyncBackedEntity } from "@/core/sync/restore.types";

function buildEntityStatuses() {
  const entities: SyncBackedEntity[] = [
    "todos",
    "habits",
    "calorie_entries",
    "workout_routines",
  ];

  return Object.fromEntries(
    entities.map((entity) => [
      entity,
      {
        entity,
        phaseOneRestorable: entity !== "workout_routines",
        phaseOneStatus:
          entity === "workout_routines" ? "excluded_in_phase_one" : "included",
        remoteState: "unavailable",
        remoteRowCount: null,
        latestUpdatedAt: null,
        reason: null,
        errorMessage: null,
      },
    ]),
  ) as RestorePreview["entityStatuses"];
}

function buildBlockedPreview(message: string): RestorePreview {
  return {
    remoteAvailable: false,
    latestRestorableBackupAt: null,
    freshnessSignature: null,
    dismissedForCurrentBackup: false,
    startupPromptEligible: false,
    eligibility: {
      kind: "blocked",
      reason: "remote_backup_unavailable",
      message,
      localCounts: {
        todos: 0,
        habits: 0,
        calorie_entries: 0,
        workout_routines: 0,
      },
    },
    entityStatuses: buildEntityStatuses(),
    warnings: [],
    disclosures: [],
  };
}

describe("restorePromptFlow", () => {
  it("keeps the prompt visible and uses direct blocked message from restore result", () => {
    const resultPreview = buildBlockedPreview(
      "Restore is blocked because this device now has active synced rows.",
    );
    const refreshedPreview = buildBlockedPreview(
      "Fallback message from refreshed preview.",
    );

    const outcome = resolveRestorePromptOutcome({
      result: {
        status: "blocked",
        preview: resultPreview,
      },
      nextPreview: refreshedPreview,
    });

    expect(outcome.dismissPrompt).toBe(false);
    expect(outcome.errorMessage).toBe(
      "Restore is blocked because this device now has active synced rows.",
    );
  });

  it("falls back to refreshed preview message when direct blocked reason is empty", () => {
    const resultPreview = buildBlockedPreview("   ");
    const refreshedPreview = buildBlockedPreview(
      "Remote backup is disabled in local-only mode.",
    );

    const outcome = resolveRestorePromptOutcome({
      result: {
        status: "blocked",
        preview: resultPreview,
      },
      nextPreview: refreshedPreview,
    });

    expect(outcome.dismissPrompt).toBe(false);
    expect(outcome.errorMessage).toBe(
      "Remote backup is disabled in local-only mode.",
    );
  });

  it("dismisses the prompt on successful restore", () => {
    const refreshedPreview = buildBlockedPreview("unused");

    const outcome = resolveRestorePromptOutcome({
      result: {
        status: "restored",
        restoredAt: "2026-04-21T12:00:00.000Z",
        freshnessSignature: "sig",
        importedCounts: {
          todos: 1,
          habits: 1,
          calorie_entries: 1,
        },
      },
      nextPreview: refreshedPreview,
    });

    expect(outcome.dismissPrompt).toBe(true);
    expect(outcome.errorMessage).toBeNull();
  });
});
