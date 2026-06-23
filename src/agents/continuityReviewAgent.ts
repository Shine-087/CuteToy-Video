import type { LLMClient } from "../core/llmClient.ts";
import { retry } from "../core/retry.ts";
import { logger } from "../core/logger.ts";
import { CONTINUITY_REVIEW_SYSTEM_PROMPT } from "../prompts/continuityReview.prompt.ts";
import type { ContinuityReview } from "../schemas/continuityReview.schema.ts";

export interface ContinuityReviewInput {
  script: unknown;
  seasonPlan: unknown;
  episodeIndex: unknown;
  narrativeBible: unknown;
  nextEpisodeBrief: unknown;
}

export class ContinuityReviewAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async reviewContinuity(input: ContinuityReviewInput): Promise<ContinuityReview> {
    return retry(
      async () => {
        return this.llm.generateJson<ContinuityReview>({
          systemPrompt: CONTINUITY_REVIEW_SYSTEM_PROMPT,
          userPayload: input,
          schemaName: "ContinuityReview",
          temperature: 0.1
        });
      },
      {
        attempts: 2,
        delayMs: 100,
        onRetry(error, attempt) {
          logger.warn("ContinuityReviewAgent output failed, retrying", {
            attempt,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    );
  }
}
