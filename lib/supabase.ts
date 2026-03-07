export type RemoteMode = "disabled" | "enabled";

let remoteMode: RemoteMode = "disabled";

export function setRemoteMode(mode: RemoteMode) {
  remoteMode = mode;
}

export function isRemoteEnabled() {
  return remoteMode === "enabled";
}

// Post-MVP: initialize Supabase client and repositories here.
