import type { LLMClient } from "../core/llmClient.ts";
import { logger } from "../core/logger.ts";
import { retry } from "../core/retry.ts";
import { REVIEW_SYSTEM_PROMPT } from "../prompts/qualityReview.prompt.ts";
import type { CharacterCollection, ContentRules, ScriptBatch } from "../schemas/script.schema.ts";
import type { ScriptReviewBatch } from "../schemas/review.schema.ts";
import { validateScriptReviewBatch } from "../schemas/review.schema.ts";

export interface ReviewScriptsInput {
  world: unknown;
  characters: CharacterCollection;
  contentRules: ContentRules;
  scriptBatch: ScriptBatch;
}

export class QualityReviewAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async reviewScripts(input: ReviewScriptsInput): Promise<ScriptReviewBatch> {
    return retry(
      async () => {
        const output = await this.llm.generateJson<ScriptReviewBatch>({
          systemPrompt: REVIEW_SYSTEM_PROMPT,
          userPayload: input,
          schemaName: "ScriptReviewBatch",
          temperature: 0.2
        });

        return validateScriptReviewBatch(output, {
          expectedScriptIds: input.scriptBatch.scripts.map((script) => script.script_id)
        });
      },
      {
        attempts: 2,
        delayMs: 100,
        onRetry(error, attempt) {
          logger.warn("QualityReviewAgent output failed validation, retrying", {
            attempt,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    );
  }
}
