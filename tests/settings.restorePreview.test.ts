import { describe, expect, it, vi } from "vitest";
import { maybeLoadRestorePreviewForSettings } from "@/features/settings/settingsRestorePreview";

describe("settings restore preview auth readiness gate", () => {
  it("does not fetch restore preview before auth bootstrap is ready", async () => {
    const loadRestorePreview = vi.fn().mockResolvedValue(undefined);
    const onAuthBootstrapping = vi.fn();

    await maybeLoadRestorePreviewForSettings({
      authBootstrapReady: false,
      loadRestorePreview,
      onAuthBootstrapping,
    });

    expect(loadRestorePreview).not.toHaveBeenCalled();
    expect(onAuthBootstrapping).toHaveBeenCalledTimes(1);
  });

  it("fetches restore preview once auth bootstrap is ready", async () => {
    const loadRestorePreview = vi.fn().mockResolvedValue(undefined);
    const onAuthBootstrapping = vi.fn();

    await maybeLoadRestorePreviewForSettings({
      authBootstrapReady: true,
      loadRestorePreview,
      onAuthBootstrapping,
    });

    expect(loadRestorePreview).toHaveBeenCalledTimes(1);
    expect(onAuthBootstrapping).not.toHaveBeenCalled();
  });

  it("can transition from auth bootstrapping to ready without terminal error action", async () => {
    const loadRestorePreview = vi.fn().mockResolvedValue(undefined);
    const onAuthBootstrapping = vi.fn();

    await maybeLoadRestorePreviewForSettings({
      authBootstrapReady: false,
      loadRestorePreview,
      onAuthBootstrapping,
    });
    await maybeLoadRestorePreviewForSettings({
      authBootstrapReady: true,
      loadRestorePreview,
      onAuthBootstrapping,
    });

    expect(onAuthBootstrapping).toHaveBeenCalledTimes(1);
    expect(loadRestorePreview).toHaveBeenCalledTimes(1);
  });
});
