import type { AIProvider } from "./types";
import { RuleBasedProvider } from "./rule-based-provider";
import { OpenAIProvider } from "./openai-provider";

let provider: AIProvider | null = null;

/** Provider factory — the only place that decides which AIProvider is active. */
export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const apiKey = process.env.OPENAI_API_KEY;
  provider = apiKey ? new OpenAIProvider(apiKey) : new RuleBasedProvider();
  return provider;
}

export * from "./types";
