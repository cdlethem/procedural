/**
 * Model-independent provider client. Any OpenAI-compatible chat-completions endpoint
 * works; credentials and endpoint stay on the service side and never reach a client.
 * Tool use travels as one JSON object per assistant turn, so no provider-specific
 * function-calling dialect is required.
 */
import { fail } from "./core";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatReply = { text: string; promptTokens: number; completionTokens: number };
export type ModelProfile = { url: string; model: string; temperature: number; maxTokens: number };

const DEFAULT_URL = "http://127.0.0.1:8080/v1";

export async function modelProfile(): Promise<ModelProfile> {
  const url = (process.env.PROCEDURALS_MODEL_URL ?? DEFAULT_URL).replace(/\/$/, "");
  let model = process.env.PROCEDURALS_MODEL_NAME ?? "";
  if (!model) {
    const response = await fetch(`${url}/models`, { headers: authorization() });
    if (!response.ok)
      fail(
        "capability",
        "UNSUPPORTED_CAPABILITY",
        `No prompt model is configured: ${url}/models replied ${response.status}. Set PROCEDURALS_MODEL_URL and PROCEDURALS_MODEL_NAME.`,
        { retryable: true },
      );
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === "object" && "data" in parsed && Array.isArray(parsed.data)) {
      const first: unknown = parsed.data[0];
      if (first && typeof first === "object" && "id" in first && typeof first.id === "string")
        model = first.id;
    }
    if (!model)
      fail("capability", "UNSUPPORTED_CAPABILITY", `${url}/models advertised no usable model id`);
  }
  return {
    url,
    model,
    temperature: Number(process.env.PROCEDURALS_MODEL_TEMPERATURE ?? "0.3"),
    maxTokens: Number(process.env.PROCEDURALS_MODEL_MAX_TOKENS ?? "3072"),
  };
}
function authorization(): Record<string, string> {
  const key = process.env.PROCEDURALS_MODEL_KEY;
  return key ? { authorization: `Bearer ${key}` } : {};
}
export async function chat(
  profile: ModelProfile,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<ChatReply> {
  const response = await fetch(`${profile.url}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authorization() },
    body: JSON.stringify({
      model: profile.model,
      messages,
      temperature: profile.temperature,
      max_tokens: profile.maxTokens,
      response_format: { type: "json_object" },
      chat_template_kwargs: { enable_thinking: false },
      stream: false,
    }),
    signal,
  });
  if (!response.ok)
    fail(
      "capability",
      "UNSUPPORTED_CAPABILITY",
      `The prompt model replied ${response.status}: ${(await response.text()).slice(0, 300)}`,
      { retryable: response.status >= 500 },
    );
  const parsed: unknown = await response.json();
  if (!parsed || typeof parsed !== "object")
    fail("capability", "UNSUPPORTED_CAPABILITY", "The prompt model returned no object");
  const body: Record<string, unknown> = { ...parsed };
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0)
    fail("capability", "UNSUPPORTED_CAPABILITY", "The prompt model returned no choices");
  const choice: unknown = choices[0];
  let text = "";
  if (choice && typeof choice === "object" && "message" in choice) {
    const message: unknown = choice.message;
    if (message && typeof message === "object" && "content" in message && typeof message.content === "string")
      text = message.content;
  }
  let promptTokens = 0,
    completionTokens = 0;
  const usage = body.usage;
  if (usage && typeof usage === "object") {
    if ("prompt_tokens" in usage && typeof usage.prompt_tokens === "number") promptTokens = usage.prompt_tokens;
    if ("completion_tokens" in usage && typeof usage.completion_tokens === "number")
      completionTokens = usage.completion_tokens;
  }
  return { text, promptTokens, completionTokens };
}
/** Extracts the first balanced JSON object, tolerating reasoning prefixes and fences. */
export function firstJsonObject(text: string): unknown {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/```(?:json)?/g, "");
  let depth = 0,
    start = -1,
    inString = false,
    escaped = false;
  for (let index = 0; index < cleaned.length; index += 1) {
    const character = cleaned[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") {
      if (depth === 0) start = index;
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) return JSON.parse(cleaned.slice(start, index + 1));
      if (depth < 0) depth = 0;
    }
  }
  fail("schema", "MALFORMED_REQUEST", "The model reply contained no JSON object", { retryable: true });
}
