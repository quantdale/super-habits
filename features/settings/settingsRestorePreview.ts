type MaybeLoadRestorePreviewForSettingsInput = {
  authBootstrapReady: boolean;
  loadRestorePreview: () => Promise<void>;
  onAuthBootstrapping: () => void;
};

export async function maybeLoadRestorePreviewForSettings(
  input: MaybeLoadRestorePreviewForSettingsInput,
): Promise<void> {
  if (!input.authBootstrapReady) {
    input.onAuthBootstrapping();
    return;
  }

  await input.loadRestorePreview();
}
