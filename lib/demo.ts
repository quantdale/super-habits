export const isDemoMode = process.env.EXPO_PUBLIC_DEMO_MODE === "1";

export function assertDemoMode(): void {
  if (!isDemoMode) {
    throw new Error("Demo seed attempted outside demo mode");
  }
}
