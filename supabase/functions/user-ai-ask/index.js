// @ts-nocheck
import { normalizeAskRequestBody } from "./normalize.js";

// NOTE: this file intentionally stops at request validation + logging.
// The actual Bedrock invocation (classify/phrase forced-tool-call calls,
// SigV4 signing) is tasks 4.3-4.8 and is blocked pending the SigV4-in-Deno
// feasibility spike (task 4.2, tracked in design.md's Open Questions).
// Nothing here is shared with parse-ai-command — that function's OpenAI
// invocation code is untouched and unrelated.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function logAskEvent(meta) {
  console.log(
    JSON.stringify({
      event: "user_ai_ask",
      ...meta,
    }),
  );
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  let requestBody;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    requestBody = normalizeAskRequestBody(await request.json());
  } catch (error) {
    const responseBody = {
      error: error instanceof Error ? error.message : "Invalid request body.",
    };
    logAskEvent({
      requestId,
      questionLength: null,
      latencyMs: Date.now() - startedAt,
      outcome: "invalid_request",
      httpStatus: 400,
    });
    return jsonResponse(400, responseBody);
  }

  // Bedrock invocation (classify + phrase, SigV4-signed) is not implemented
  // yet — see the file-level note above. Validated requests get a clear
  // 501 rather than a silent/fake success.
  logAskEvent({
    requestId,
    questionLength: requestBody.question.length,
    latencyMs: Date.now() - startedAt,
    outcome: "not_implemented",
    httpStatus: 501,
  });
  return jsonResponse(501, {
    error: "user-ai-ask model invocation is not implemented yet (pending Bedrock integration).",
  });
});
