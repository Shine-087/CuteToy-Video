import type { LLMClient } from "../core/llmClient.ts";
import type { NarrativeBibleUpdate } from "../schemas/series.schema.ts";
import { STATE_MANAGER_SYSTEM_PROMPT } from "../prompts/stateManager.prompt.ts";

export interface StateManagerInput {
  charactersConfig: unknown;
  currentNarrativeBible: unknown;
  episodeScript: unknown;
  episodeBrief: unknown;
}

export class StateManagerAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async updateState(input: StateManagerInput): Promise<NarrativeBibleUpdate> {
    return this.llm.generateJson<NarrativeBibleUpdate>({
      systemPrompt: STATE_MANAGER_SYSTEM_PROMPT,
      userPayload: input,
      schemaName: "NarrativeBibleUpdate",
      temperature: 0.3
    });
  }
}
