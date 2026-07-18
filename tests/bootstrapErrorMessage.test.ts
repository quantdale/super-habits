import { describe, expect, it } from 'vitest';
import { getDbBootstrapErrorMessage } from '../core/providers/bootstrapErrorMessage';

// ERR-002: the old web copy advised "site data cleared", which on a
// local-first app destroys the user's OPFS SQLite database.

describe('getDbBootstrapErrorMessage', () => {
  it('returns the restart message on native', () => {
    const message = getDbBootstrapErrorMessage({
      platformOs: 'android',
      hasSharedArrayBuffer: false,
    });
    expect(message).toMatch(/restart the app/i);
  });

  it('identifies an unsupported browser when SharedArrayBuffer is missing', () => {
    const message = getDbBootstrapErrorMessage({
      platformOs: 'web',
      hasSharedArrayBuffer: false,
    });
    expect(message).toMatch(/browser does not support/i);
    expect(message).toMatch(/Chrome, Edge, or Firefox/);
  });

  it('suggests closing duplicate tabs when the browser is capable (OPFS lock)', () => {
    const message = getDbBootstrapErrorMessage({
      platformOs: 'web',
      hasSharedArrayBuffer: true,
    });
    expect(message).toMatch(/another tab/i);
    expect(message).toMatch(/data is still safe/i);
  });

  it('never advises clearing site data in any branch', () => {
    const messages = [
      getDbBootstrapErrorMessage({ platformOs: 'web', hasSharedArrayBuffer: true }),
      getDbBootstrapErrorMessage({ platformOs: 'web', hasSharedArrayBuffer: false }),
      getDbBootstrapErrorMessage({ platformOs: 'ios', hasSharedArrayBuffer: false }),
    ];
    for (const message of messages) {
      expect(message.toLowerCase()).not.toContain('clear');
      expect(message.toLowerCase()).not.toContain('site data');
    }
  });
});
