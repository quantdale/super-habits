import { describe, it, expect } from 'vitest';
import * as notifications from '../lib/notifications';

describe('notifications error handling', () => {
  it('returns null for invalid/corrupt ID', async () => {
    await expect(notifications.cancelScheduledNotification(undefined)).resolves.toBeUndefined();
    await expect(notifications.cancelScheduledNotification(null)).resolves.toBeUndefined();
    // Simulate invalid ID
    await expect(notifications.cancelScheduledNotification('invalid-id')).resolves.toBeUndefined();
  });
});
