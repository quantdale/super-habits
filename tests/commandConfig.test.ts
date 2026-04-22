import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isSupabaseConfigured } = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured,
}));

import {
  getAiCommandParseConfig,
  isAiCommandInternalRolloutAvailable,
  isAiCommandRemoteBackendConfigured,
  isAiCommandRemoteModeEnabled,
} from "@/features/command/commandConfig";

const ORIGINAL_ENV = {
  EXPO_PUBLIC_AI_COMMAND_PARSE_MODE: process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE,
  EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT: process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT,
  EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST: process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST,
  EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME:
    process.env.EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME,
  EXPO_PUBLIC_AI_COMMAND_PROXY_URL: process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL,
};

describe("features/command/commandConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE;
    delete process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT;
    delete process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST;
    delete process.env.EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME;
    delete process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL;
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE = ORIGINAL_ENV.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE;
    process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT =
      ORIGINAL_ENV.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT;
    process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST = ORIGINAL_ENV.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST;
    process.env.EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME =
      ORIGINAL_ENV.EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME;
    process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL = ORIGINAL_ENV.EXPO_PUBLIC_AI_COMMAND_PROXY_URL;
  });

  it("defaults public builds to mock mode with internal rollout disabled", () => {
    isSupabaseConfigured.mockReturnValue(false);

    const config = getAiCommandParseConfig();

    expect(config).toEqual({
      mode: "mock",
      internalRolloutEnabled: false,
      backendHost: "supabase_edge",
      supabaseFunctionName: "parse-ai-command",
      customProxyUrl: null,
    });
    expect(isAiCommandRemoteModeEnabled(config)).toBe(false);
    expect(isAiCommandInternalRolloutAvailable(config)).toBe(false);
  });

  it("keeps internal rollout unavailable until the backend is configured", () => {
    process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE = "remote_with_fallback";
    process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT = "true";
    isSupabaseConfigured.mockReturnValue(false);

    const config = getAiCommandParseConfig();

    expect(isAiCommandRemoteModeEnabled(config)).toBe(true);
    expect(isAiCommandRemoteBackendConfigured(config)).toBe(false);
    expect(isAiCommandInternalRolloutAvailable(config)).toBe(false);
  });

  it("marks internal rollout as available only when remote mode, capability flag, and backend are all configured", () => {
    process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE = "remote_with_fallback";
    process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT = "true";
    isSupabaseConfigured.mockReturnValue(true);

    const config = getAiCommandParseConfig();

    expect(isAiCommandRemoteModeEnabled(config)).toBe(true);
    expect(isAiCommandRemoteBackendConfigured(config)).toBe(true);
    expect(isAiCommandInternalRolloutAvailable(config)).toBe(true);
  });

  it("supports custom proxy rollout readiness when a URL is provided", () => {
    process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE = "remote_with_fallback";
    process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT = "true";
    process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST = "custom_url";
    process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL = "https://example.com/parse";
    isSupabaseConfigured.mockReturnValue(false);

    const config = getAiCommandParseConfig();

    expect(config.backendHost).toBe("custom_url");
    expect(isAiCommandRemoteBackendConfigured(config)).toBe(true);
    expect(isAiCommandInternalRolloutAvailable(config)).toBe(true);
  });
});
