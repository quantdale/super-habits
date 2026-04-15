import { describe, expect, it } from "vitest";
import { createLinkedActionsNotice } from "@/core/linked-actions/linkedActionsNotice";
import {
  createInAppNoticeState,
  dismissInAppNotice,
  enqueueInAppNotice,
  getCurrentInAppNotice,
  MAX_IN_APP_NOTICES,
} from "@/core/notifications/inAppNotices.store";

describe("in-app notice store", () => {
  it("creates typed linked action notices with source, target, and destination metadata", () => {
    const notice = createLinkedActionsNotice({
      message: "Linked Actions updated Evening stretch.",
      reason: "Hydrate after workout is linked to mark your recovery habit for today.",
      source: {
        feature: "workout",
        entityType: "routine",
        entityId: "routine-1",
        label: "Hydrate after workout",
      },
      target: {
        feature: "habits",
        entityType: "habit",
        entityId: "habit-1",
        label: "Evening stretch",
      },
      destination: {
        kind: "linked-actions-target",
        href: "/(tabs)/habits",
        feature: "habits",
        entityType: "habit",
        entityId: "habit-1",
        label: "Evening stretch",
      },
    });

    expect(notice.payload.kind).toBe("linked-actions");
    expect(notice.payload.message).toBe("Linked Actions updated Evening stretch.");
    expect(notice.payload.source.feature).toBe("workout");
    expect(notice.payload.target.feature).toBe("habits");
    expect(notice.payload.destination?.kind).toBe("linked-actions-target");
  });

  it("keeps the newest notice first", () => {
    const first = createLinkedActionsNotice({
      message: "First",
      reason: "First reason",
      source: { feature: "todos", entityType: "todo" },
      target: { feature: "habits", entityType: "habit" },
    });
    const second = createLinkedActionsNotice({
      message: "Second",
      reason: "Second reason",
      source: { feature: "habits", entityType: "habit" },
      target: { feature: "todos", entityType: "todo" },
    });

    const state = enqueueInAppNotice(
      enqueueInAppNotice(createInAppNoticeState(), first),
      second,
    );

    expect(getCurrentInAppNotice(state)?.id).toBe(second.id);
    expect(state.notices).toHaveLength(2);
  });

  it("trims the queue to the configured maximum", () => {
    let state = createInAppNoticeState();

    for (let index = 0; index < MAX_IN_APP_NOTICES + 2; index += 1) {
      state = enqueueInAppNotice(
        state,
        createLinkedActionsNotice({
          message: `Notice ${index}`,
          reason: "Trim test",
          source: { feature: "todos", entityType: "todo", entityId: `todo-${index}` },
          target: { feature: "habits", entityType: "habit", entityId: `habit-${index}` },
        }),
      );
    }

    expect(state.notices).toHaveLength(MAX_IN_APP_NOTICES);
  });

  it("dismisses notices by id", () => {
    const first = createLinkedActionsNotice({
      message: "First",
      reason: "First reason",
      source: { feature: "todos", entityType: "todo" },
      target: { feature: "habits", entityType: "habit" },
    });
    const second = createLinkedActionsNotice({
      message: "Second",
      reason: "Second reason",
      source: { feature: "workout", entityType: "routine" },
      target: { feature: "habits", entityType: "habit" },
    });

    const seeded = enqueueInAppNotice(
      enqueueInAppNotice(createInAppNoticeState(), first),
      second,
    );
    const next = dismissInAppNotice(seeded, second.id);

    expect(next.notices).toHaveLength(1);
    expect(getCurrentInAppNotice(next)?.id).toBe(first.id);
  });
});
