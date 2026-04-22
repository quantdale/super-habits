import { isSupabaseConfigured } from "@/lib/supabase";

export type AiCommandParseMode = "mock" | "remote_with_fallback";
export type AiCommandBackendHost = "supabase_edge" | "custom_url";

export type AiCommandParseConfig = {
  mode: AiCommandParseMode;
  internalRolloutEnabled: boolean;
  backendHost: AiCommandBackendHost;
  supabaseFunctionName: string;
  customProxyUrl: string | null;
};

const DEFAULT_SUPABASE_FUNCTION_NAME = "parse-ai-command";

function readParseMode(value: string | undefined): AiCommandParseMode {
  return value === "remote_with_fallback" ? "remote_with_fallback" : "mock";
}

function readBackendHost(value: string | undefined): AiCommandBackendHost {
  return value === "custom_url" ? "custom_url" : "supabase_edge";
}

function readBooleanFlag(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function getAiCommandParseConfig(): AiCommandParseConfig {
  const customProxyUrl = process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL?.trim() ?? "";
  const supabaseFunctionName =
    process.env.EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME?.trim() ??
    DEFAULT_SUPABASE_FUNCTION_NAME;

  return {
    mode: readParseMode(process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE),
    internalRolloutEnabled: readBooleanFlag(
      process.env.EXPO_PUBLIC_AI_COMMAND_INTERNAL_ROLLOUT,
    ),
    backendHost: readBackendHost(process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST),
    supabaseFunctionName,
    customProxyUrl: customProxyUrl.length > 0 ? customProxyUrl : null,
  };
}

export function isAiCommandRemoteModeEnabled(config = getAiCommandParseConfig()): boolean {
  return config.mode === "remote_with_fallback";
}

export function isAiCommandInternalRolloutEnabled(config = getAiCommandParseConfig()): boolean {
  return config.internalRolloutEnabled;
}

export function isAiCommandRemoteBackendConfigured(
  config = getAiCommandParseConfig(),
): boolean {
  if (config.backendHost === "custom_url") {
    return config.customProxyUrl !== null;
  }

  return isSupabaseConfigured();
}

export function isAiCommandInternalRolloutAvailable(
  config = getAiCommandParseConfig(),
): boolean {
  return (
    isAiCommandInternalRolloutEnabled(config) &&
    isAiCommandRemoteModeEnabled(config) &&
    isAiCommandRemoteBackendConfigured(config)
  );
}
