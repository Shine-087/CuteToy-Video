import type { LLMClient } from "../core/llmClient.ts";
import { retry } from "../core/retry.ts";
import { logger } from "../core/logger.ts";
import { WRITER_SYSTEM_PROMPT } from "../prompts/writer.prompt.ts";
import type { CharacterCollection, ContentRules, ScriptBatch } from "../schemas/script.schema.ts";
import { validateScriptBatch } from "../schemas/script.schema.ts";

import type { EpisodeBrief } from "../schemas/series.schema.ts";

export interface WriterInput {
  world: unknown;
  characters: CharacterCollection;
  contentRules: ContentRules;
  narrativeBible: unknown;
  episodeBrief: EpisodeBrief;
  recentEpisodesSummary?: unknown[];
}

export class WriterAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async generate(input: WriterInput): Promise<ScriptBatch> {
    return retry(
      async () => {
        const output = await this.llm.generateJson<ScriptBatch>({
          systemPrompt: WRITER_SYSTEM_PROMPT,
          userPayload: input,
          schemaName: "ScriptBatch",
          temperature: 0.8
        });

        return validateScriptBatch(output, {
          expectedCount: 3, // 生成 3 个变体供下游选择
          characters: input.characters,
          contentRules: input.contentRules
        });
      },
      {
        attempts: 2,
        delayMs: 100,
        onRetry(error, attempt) {
          logger.warn("WriterAgent output failed validation, retrying", {
            attempt,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    );
  }
}
