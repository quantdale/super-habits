/** Pure parsing/selection helpers shared by the native provisioner and runner. */

export function parseAdbDevices(output) {
  return String(output ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('List of devices attached'))
    .map((line) => {
      const [serial, state, ...details] = line.split(/\s+/);
      return { serial, state, details: details.join(' ') };
    });
}

/**
 * @param {string} output
 * @param {string|null} [requestedSerial]
 */
export function selectAndroidDevice(output, requestedSerial = null) {
  const devices = parseAdbDevices(output).filter((device) => device.state === 'device');
  if (requestedSerial) {
    const selected = devices.find((device) => device.serial === requestedSerial);
    if (!selected) {
      const observed = devices.map((device) => device.serial).join(', ') || 'none';
      throw new Error(
        `Requested Android target '${requestedSerial}' is not connected (observed: ${observed}).`,
      );
    }
    return selected;
  }
  if (devices.length === 0) {
    throw new Error('No booted Android emulator/device is available.');
  }
  if (devices.length > 1) {
    throw new Error(
      `Multiple Android targets are connected (${devices.map((device) => device.serial).join(', ')}); set ANDROID_SERIAL or NATIVE_ANDROID_SERIAL.`,
    );
  }
  return devices[0];
}

export function parseAndroidProperties(output) {
  const properties = {};
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const match = line.match(/^\[([^\]]+)\]:\s*\[([^\]]*)\]/);
    if (match) properties[match[1]] = match[2];
  }
  return properties;
}

export function parsePackageIdentity(output, appId) {
  const text = String(output ?? '');
  const packageMatch = text.match(new RegExp(`Package \\[${escapeRegExp(appId)}\\]`));
  const versionName = text.match(/versionName=([^\s]+)/)?.[1] ?? null;
  const versionCode = text.match(/versionCode=(\d+)/)?.[1] ?? null;
  return {
    appId,
    present: packageMatch !== null || versionName !== null || versionCode !== null,
    versionName,
    versionCode: versionCode === null ? null : Number(versionCode),
  };
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
