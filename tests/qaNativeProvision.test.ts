import { describe, expect, it } from 'vitest';
import {
  parseAdbDevices,
  parseAndroidProperties,
  parsePackageIdentity,
  selectAndroidDevice,
} from '../scripts/native-qa-utils.mjs';

describe('native Android QA helpers', () => {
  it('parses connected ADB devices and ignores the header', () => {
    expect(
      parseAdbDevices(
        'List of devices attached\nemulator-5554\tdevice product:sdk_gphone_x86_64\nserial-offline\toffline\n',
      ),
    ).toEqual([
      {
        serial: 'emulator-5554',
        state: 'device',
        details: 'product:sdk_gphone_x86_64',
      },
      { serial: 'serial-offline', state: 'offline', details: '' },
    ]);
  });

  it('requires an unambiguous requested or single connected target', () => {
    const devices = 'List of devices attached\na\tdevice\nb\tdevice\n';
    expect(() => selectAndroidDevice(devices)).toThrow(/Multiple Android targets/);
    expect(selectAndroidDevice(devices, 'b').serial).toBe('b');
    expect(() => selectAndroidDevice(devices, 'missing')).toThrow(/not connected/);
  });

  it('parses Android properties and installed package identity', () => {
    expect(
      parseAndroidProperties(
        '[ro.build.version.sdk]: [36]\n[ro.product.cpu.abi]: [x86_64]\n[sys.boot_completed]: [1]\n',
      ),
    ).toEqual({
      'ro.build.version.sdk': '36',
      'ro.product.cpu.abi': 'x86_64',
      'sys.boot_completed': '1',
    });
    expect(
      parsePackageIdentity(
        'Package [com.dale16.superhabits]\n  versionCode=1 minSdk=24\n  versionName=1.0.0\n',
        'com.dale16.superhabits',
      ),
    ).toEqual({
      appId: 'com.dale16.superhabits',
      present: true,
      versionName: '1.0.0',
      versionCode: 1,
    });
  });
});
