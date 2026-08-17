import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { useAppTheme } from '@/core/providers/themeContext';
import { useAppBootstrapState } from '@/core/providers/appBootstrapContext';
import { Card } from '@/core/ui/Card';
import { Button } from '@/core/ui/Button';
import { ValidationError } from '@/core/ui/ValidationError';
import { exportPortableBackup } from '@/core/portable/portableExport';
import {
  confirmPortableImport,
  describePortableCounts,
  preparePortableImport,
} from '@/core/portable/portableImport';
import {
  isNativePortablePlatform,
  pickPortableFileNative,
  readPickedPortableFileWeb,
  savePortableFileNative,
  savePortableFileOnWeb,
} from '@/core/portable/portableFileIo';
import type { PortableBackupFile, PortableImportPreview } from '@/core/portable/portable.types';
import { inspectLocalAccountDataState } from '@/core/auth/account.data';
import { isDeviceEmptyForRestore } from '@/core/backup/backupRestore';

const PORTABLE_ACCENT = '#0f766e';

export function SettingsPortableSection() {
  const { tokens } = useAppTheme();
  const { refreshAccountState } = useAppBootstrapState();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PortableImportPreview | null>(null);
  const [pendingFile, setPendingFile] = useState<PortableBackupFile | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [deviceEmpty, setDeviceEmpty] = useState<boolean | null>(null);
  const webFileInputRef = useRef<HTMLInputElement>(null);

  // Portable import is the OFFLINE path: its eligibility is the semantic
  // device emptiness used by the import gate itself (all user tables +
  // outbox), NOT the cloud-restore eligibility — portable import must work
  // on devices without Supabase or remote rows. The authoritative gate is
  // re-checked inside the import transaction.
  useEffect(() => {
    let cancelled = false;
    void inspectLocalAccountDataState()
      .then((local) => {
        if (!cancelled) setDeviceEmpty(isDeviceEmptyForRestore(local));
      })
      .catch(() => {
        if (!cancelled) setDeviceEmpty(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // While the emptiness probe is loading, allow the attempt: the pipeline
  // re-checks before any write.
  const importDisabled = exporting || importing || validating || deviceEmpty === false;

  const handleExport = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await exportPortableBackup();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (isNativePortablePlatform()) {
        await savePortableFileNative(result.fileName, result.json);
        setMessage(`Backup exported: ${result.fileName}.`);
      } else {
        savePortableFileOnWeb(result.fileName, result.json);
        setMessage(
          `Backup exported: ${result.fileName} (${(result.byteLength / 1024).toFixed(1)} KB).`,
        );
      }
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'Export failed. Your data was not changed.',
      );
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  const runImportPreparation = useCallback(async (fileName: string, text: string) => {
    setValidating(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await preparePortableImport({ fileName, text });
      if (outcome.status === 'rejected') {
        setError(outcome.message);
        setPreview(null);
        setPendingFile(null);
        setSelectedFileName(null);
        return;
      }
      setSelectedFileName(fileName);
      setPreview(outcome.preview);
      setPendingFile(outcome.file);
    } catch (prepareError) {
      setError(
        prepareError instanceof Error
          ? prepareError.message
          : 'The file could not be read. Nothing was changed.',
      );
      setPreview(null);
      setPendingFile(null);
      setSelectedFileName(null);
    } finally {
      setValidating(false);
    }
  }, []);

  const handlePickWeb = useCallback(
    async (file: File) => {
      const read = await readPickedPortableFileWeb(file);
      if ('error' in read) {
        setError(read.error);
        return;
      }
      await runImportPreparation(read.name, read.text);
    },
    [runImportPreparation],
  );

  const handlePickNative = useCallback(async () => {
    if (importing || validating) return;
    setError(null);
    setMessage(null);
    try {
      const picked = await pickPortableFileNative();
      if (picked === null) return; // user cancelled the picker
      if ('error' in picked) {
        setError(picked.error);
        return;
      }
      await runImportPreparation(picked.name, picked.text);
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'The file could not be selected.');
    }
  }, [importing, validating, runImportPreparation]);

  const handleCancelImport = useCallback(() => {
    setPreview(null);
    setPendingFile(null);
    setSelectedFileName(null);
    setError(null);
  }, []);

  const handleConfirmImport = useCallback(async () => {
    if (!preview || !pendingFile || importing) return;
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      // `pendingFile` is the fully validated file from the prepare step;
      // confirm revalidates emptiness + owner inside the transaction, so a
      // double activation can never import twice.
      const outcome = await confirmPortableImport({ file: pendingFile });
      if (outcome.status === 'restored') {
        const total = Object.values(outcome.importedCounts).reduce(
          (sum, count) => sum + (count ?? 0),
          0,
        );
        setMessage(`Import complete. ${total.toLocaleString()} records were restored.`);
        setPreview(null);
        setPendingFile(null);
        setSelectedFileName(null);
        // The import changes the local dataset shape (user data + possible
        // import-origin fingerprint), so the account card must re-decide
        // immediately — an imported owner-backed dataset must expose
        // source-account recovery instead of a stale pre-import state.
        void refreshAccountState().catch(() => undefined);
      } else {
        setError(outcome.message);
      }
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : 'Import failed. Your local data was left unchanged.',
      );
    } finally {
      setImporting(false);
    }
  }, [preview, pendingFile, importing]);

  return (
    <Card accentColor={PORTABLE_ACCENT} className="mb-0">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1">
          <Text className="text-base font-semibold" style={{ color: tokens.text }}>
            Portable data
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            Create a portable copy of your Super Habits data, or import one on an empty device.
            Portable backup works without an account and does not touch cloud backup.
          </Text>
        </View>
      </View>

      <View
        className="mt-3 rounded-2xl border px-4 py-3"
        style={{ borderColor: tokens.warningBorder, backgroundColor: tokens.warningBackground }}
      >
        <Text className="text-sm font-semibold" style={{ color: tokens.warningText }}>
          Before you export
        </Text>
        <Text className="mt-1 text-sm leading-6" style={{ color: tokens.warningText }}>
          This file contains your Super Habits data. Store it somewhere you trust. The exported file
          is not encrypted — anyone with the file can read its contents.
        </Text>
      </View>

      <ValidationError message={error} />
      {message ? (
        <View className="mt-2">
          <Text
            className="text-sm leading-6"
            accessibilityRole="alert"
            style={{ color: tokens.accent }}
          >
            {message}
          </Text>
        </View>
      ) : null}

      <View className="mt-4 gap-2">
        <Button
          label={exporting ? 'Exporting...' : 'Export data'}
          onPress={() => void handleExport()}
          disabled={exporting}
          color={PORTABLE_ACCENT}
        />
        <Button
          label={validating ? 'Reading file...' : importing ? 'Importing...' : 'Import data'}
          onPress={() => {
            if (Platform.OS === 'web') {
              webFileInputRef.current?.click();
            } else {
              void handlePickNative();
            }
          }}
          disabled={importDisabled}
          variant="ghost"
        />
        {!deviceEmpty ? (
          <Text className="text-sm leading-6" style={{ color: tokens.textMuted }}>
            Import is available only on an empty device. This device contains local data, so
            portable import is paused here.
          </Text>
        ) : null}
      </View>

      {Platform.OS === 'web' ? (
        <input
          ref={webFileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handlePickWeb(file);
            event.target.value = '';
          }}
        />
      ) : null}

      {preview ? (
        <View
          className="mt-4 rounded-2xl border px-4 py-3"
          style={{ borderColor: tokens.border, backgroundColor: tokens.surfaceElevated }}
        >
          <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
            Portable Super Habits backup
          </Text>
          <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
            {selectedFileName ?? 'Selected file'}
          </Text>
          {preview.exportedAt ? (
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Created: {new Date(preview.exportedAt).toLocaleString()}
            </Text>
          ) : null}

          <View className="mt-3">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Contains
            </Text>
            {describePortableCounts(preview.counts).map(({ label, count }) => (
              <Text
                key={label}
                className="mt-1 text-sm leading-6"
                style={{ color: tokens.textMuted }}
              >
                {label}: {count.toLocaleString()}
              </Text>
            ))}
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Settings: {preview.settingsIncluded ? 'included' : 'not included'}
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              Integrity: {preview.integrityVerified ? 'Verified' : 'Failed'}
            </Text>
          </View>

          <View className="mt-3">
            <Text className="text-sm font-semibold" style={{ color: tokens.text }}>
              Account compatibility
            </Text>
            <Text className="mt-1 text-sm leading-6" style={{ color: tokens.textMuted }}>
              {preview.ownerMessage}
            </Text>
            {preview.disclosures.map((disclosure) => (
              <Text
                key={disclosure}
                className="mt-1 text-sm leading-6"
                style={{ color: tokens.textMuted }}
              >
                {disclosure}
              </Text>
            ))}
          </View>

          {preview.warnings.map((warning) => (
            <Text
              key={warning}
              className="mt-2 text-sm leading-6"
              style={{ color: tokens.warningText }}
            >
              {warning}
            </Text>
          ))}

          <View className="mt-4 gap-2">
            <Button
              label={importing ? 'Importing...' : 'Import'}
              onPress={() => void handleConfirmImport()}
              disabled={importing}
              color={PORTABLE_ACCENT}
            />
            <Button
              label="Cancel"
              onPress={handleCancelImport}
              disabled={importing}
              variant="ghost"
            />
          </View>
        </View>
      ) : null}
    </Card>
  );
}
