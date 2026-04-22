import { preflightCommandDraft } from "./command.domain";
import {
  getAiCommandParseConfig,
  isAiCommandInternalRolloutAvailable,
  isAiCommandRemoteModeEnabled,
} from "./commandConfig";
import { getAiCommandInternalRolloutPreference } from "./commandInternalRollout";
import { mockCommandParser } from "./mockCommandParser";
import { realCommandParser } from "./realCommandParser";
import type {
  AiCommandParser,
  CommandParseExecution,
  CommandParseObservation,
  ParseCommandInput,
  ParseCommandResult,
  ParsePath,
  ParseReasonCode,
} from "./types";

function annotateFallbackResult(result: ParseCommandResult): ParseCommandResult {
  if (result.outcome !== "draft") {
    return result;
  }

  return {
    outcome: "draft",
    draft: {
      ...result.draft,
      parserKind: "model_proxy_fallback",
    },
  };
}

function getLatencyBucket(latencyMs: number): CommandParseObservation["latencyBucket"] {
  if (latencyMs < 500) return "fast";
  if (latencyMs < 1500) return "noticeable";
  return "frustrating";
}

function getReasonCode(result: ParseCommandResult): ParseReasonCode | null {
  if (result.outcome === "unsupported") {
    return result.reasonCode ?? "unsupported";
  }

  if (result.outcome === "unavailable") {
    return result.reasonCode;
  }

  return null;
}

function buildObservation(
  result: ParseCommandResult,
  effectivePath: ParsePath,
  latencyMs: number,
): CommandParseObservation {
  return {
    effectivePath,
    outcome: result.outcome,
    draftStatus: result.outcome === "draft" ? result.draft.status : null,
    warningCodes: result.outcome === "draft" ? result.draft.warnings.map((warning) => warning.code) : [],
    missingFieldNames:
      result.outcome === "draft"
        ? result.draft.missingFields.map((missingField) => missingField.field)
        : [],
    latencyMs,
    latencyBucket: getLatencyBucket(latencyMs),
    reasonCode: getReasonCode(result),
  };
}

export class CommandParserFacade implements AiCommandParser {
  async parse(input: ParseCommandInput): Promise<ParseCommandResult> {
    const execution = await this.parseWithObservation(input);
    return execution.result;
  }

  async parseWithObservation(input: ParseCommandInput): Promise<CommandParseExecution> {
    const startedAt = Date.now();
    const preflight = preflightCommandDraft(input);
    if (preflight) {
      const config = getAiCommandParseConfig();
      const remoteCapabilityAvailable = isAiCommandInternalRolloutAvailable(config);
      const localInternalPreference = remoteCapabilityAvailable
        ? await getAiCommandInternalRolloutPreference()
        : false;
      const effectivePath: ParsePath =
        remoteCapabilityAvailable && localInternalPreference ? "remote" : "mock";
      const latencyMs = Date.now() - startedAt;
      return {
        result: preflight,
        observation: buildObservation(preflight, effectivePath, latencyMs),
      };
    }

    const config = getAiCommandParseConfig();
    const remoteCapabilityAvailable = isAiCommandInternalRolloutAvailable(config);
    const localInternalPreference = remoteCapabilityAvailable
      ? await getAiCommandInternalRolloutPreference()
      : false;
    const shouldAttemptRemote =
      isAiCommandRemoteModeEnabled(config) &&
      remoteCapabilityAvailable &&
      localInternalPreference;

    if (!shouldAttemptRemote) {
      const result = await mockCommandParser.parse(input);
      const latencyMs = Date.now() - startedAt;
      return {
        result,
        observation: buildObservation(result, "mock", latencyMs),
      };
    }

    const remoteResult = await realCommandParser.parse(input);
    if (remoteResult.outcome !== "unavailable") {
      const latencyMs = Date.now() - startedAt;
      return {
        result: remoteResult,
        observation: buildObservation(remoteResult, "remote", latencyMs),
      };
    }

    try {
      const fallbackResult = annotateFallbackResult(await mockCommandParser.parse(input));
      const latencyMs = Date.now() - startedAt;
      return {
        result: fallbackResult,
        observation: buildObservation(fallbackResult, "remote_with_fallback", latencyMs),
      };
    } catch {
      const latencyMs = Date.now() - startedAt;
      return {
        result: remoteResult,
        observation: buildObservation(remoteResult, "remote", latencyMs),
      };
    }
  }
}

export const commandParser = new CommandParserFacade();
