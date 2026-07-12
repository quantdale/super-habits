/**
 * User-facing copy for a failed database bootstrap.
 *
 * Web failures come in two flavors: the browser genuinely lacks the required
 * features (no SharedArrayBuffer -> no OPFS-backed SQLite), or initialization
 * failed on a capable browser — most commonly because another SuperHabits tab
 * holds the OPFS write lock. The copy must never advise clearing site data:
 * on a local-first app that destroys the user's database.
 */
export function getDbBootstrapErrorMessage(input: {
  platformOs: string;
  hasSharedArrayBuffer: boolean;
}): string {
  if (input.platformOs !== "web") {
    return "Database failed to initialize. Please restart the app.";
  }

  if (!input.hasSharedArrayBuffer) {
    return (
      "This browser does not support the features SuperHabits needs to store data. " +
      "Please use a recent version of Chrome, Edge, or Firefox."
    );
  }

  return (
    "SuperHabits could not start its local database. This usually happens when the app " +
    "is already open in another tab — close other SuperHabits tabs, then reload this page. " +
    "Your data is still safe on this device."
  );
}
