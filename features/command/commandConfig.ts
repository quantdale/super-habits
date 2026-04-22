export type AiCommandParseMode = "mock" | "remote_with_fallback";
export type AiCommandBackendHost = "supabase_edge" | "custom_url";

export type AiCommandParseConfig = {
  mode: AiCommandParseMode;
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

export function getAiCommandParseConfig(): AiCommandParseConfig {
  const customProxyUrl = process.env.EXPO_PUBLIC_AI_COMMAND_PROXY_URL?.trim() ?? "";
  const supabaseFunctionName =
    process.env.EXPO_PUBLIC_AI_COMMAND_SUPABASE_FUNCTION_NAME?.trim() ??
    DEFAULT_SUPABASE_FUNCTION_NAME;

  return {
    mode: readParseMode(process.env.EXPO_PUBLIC_AI_COMMAND_PARSE_MODE),
    backendHost: readBackendHost(process.env.EXPO_PUBLIC_AI_COMMAND_BACKEND_HOST),
    supabaseFunctionName,
    customProxyUrl: customProxyUrl.length > 0 ? customProxyUrl : null,
  };
}

export function isAiCommandRemoteModeEnabled(config = getAiCommandParseConfig()): boolean {
  return config.mode === "remote_with_fallback";
}

