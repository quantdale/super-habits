import type { NotificationResponse } from 'expo-notifications';

type NotificationResponseHandler = (response: NotificationResponse) => void;

let handler: NotificationResponseHandler | null = null;

/**
 * Installs the one app-level response entrypoint. Native listeners, cold-start
 * recovery, and the test-build injection seam all feed the same dispatcher.
 */
export function setNotificationResponseHandler(next: NotificationResponseHandler | null): void {
  handler = next;
}

/** Test-build-only seam; it never interprets responses itself. */
export function injectNotificationResponseForTesting(response: NotificationResponse): void {
  handler?.(response);
}
