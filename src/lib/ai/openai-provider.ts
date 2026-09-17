import type { AIAnalysisOutput, AIProvider, DeveloperAnalysisInput } from "./types";
import { RuleBasedProvider } from "./rule-based-provider";

/**
 * Optional provider used only when OPENAI_API_KEY is set. It is prompted to
 * use ONLY the structured facts it is given (never invent facts, never make
 * employment/HR judgments — section 48), and must return the exact same
 * shape as RuleBasedProvider so the two are interchangeable everywhere in
 * the app. If the call fails for any reason, it falls back to the
 * deterministic provider so the UI never breaks on an AI outage.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private fallback = new RuleBasedProvider();
  private model: string;
  private apiKey: string;

  constructor(apiKey: string, model = process.env.OPENAI_MODEL ?? "gpt-4o-mini") {
    this.apiKey = apiKey;
    this.model = model;
  }

  async narrateSummary(prompt: string, facts: string[]): Promise<string> {
    try {
      const res = await this.complete([
        {
          role: "system",
          content:
            "You write short, factual engineering-management summaries. Use ONLY the facts provided. Never speculate, never make HR/employment judgments, never infer personal characteristics.",
        },
        { role: "user", content: `${prompt}\n\nFacts:\n${facts.map((f) => `- ${f}`).join("\n")}` },
      ]);
      return res ?? (await this.fallback.narrateSummary(prompt, facts));
    } catch {
      return this.fallback.narrateSummary(prompt, facts);
    }
  }

  async analyzeDeveloper(input: DeveloperAnalysisInput): Promise<AIAnalysisOutput> {
    try {
      const raw = await this.complete(
        [
          {
            role: "system",
            content: [
              "You are the AI insight engine for DemoPulse, an internal demo/talent evaluation platform.",
              "Analyze ONLY the structured JSON data provided about one developer.",
              "Never invent facts not present in the data. Never make employment/termination recommendations.",
              "Never infer protected characteristics or diagnose personality.",
              'Frame risk items as "Potential development opportunity" or "Risk signal", never as absolute judgments.',
              "Return strict JSON matching this TypeScript type:",
              `{ summary: string; strengths: {title:string; body:string; evidence:{details:string[]}}[]; growthAreas: same[]; riskSignals: same[]; recommendations: same[]; recognition: same[] }`,
            ].join(" "),
          },
          { role: "user", content: JSON.stringify(input) },
        ],
        true
      );
      if (!raw) throw new Error("empty response");
      const parsed = JSON.parse(raw) as AIAnalysisOutput;
      return parsed;
    } catch {
      return this.fallback.analyzeDeveloper(input);
    }
  }

  private async complete(
    messages: { role: "system" | "user"; content: string }[],
    json = false
  ): Promise<string | null> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.2,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? null;
  }
}
