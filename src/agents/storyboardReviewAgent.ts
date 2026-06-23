import type { LLMClient } from "../core/llmClient.ts";
import type { StoryboardReview } from "../schemas/visual.schema.ts";
import type { PreviousEpisodeContext } from "../core/visualOrchestrator.ts";
import { STORYBOARD_REVIEW_SYSTEM_PROMPT } from "../prompts/storyboardReview.prompt.ts";

export interface StoryboardReviewInput {
  storyboard: unknown;
  script: unknown;
  visualStyle: unknown;
  previousEpisodeContext?: PreviousEpisodeContext | null;
}

export class StoryboardReviewAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async reviewStoryboard(input: StoryboardReviewInput): Promise<StoryboardReview> {
    const userPayload: Record<string, unknown> = {
      storyboard: input.storyboard,
      script: input.script,
      visualStyle: input.visualStyle
    };

    if (input.previousEpisodeContext) {
      userPayload.previousEpisodeContext = input.previousEpisodeContext;
    }

    return this.llm.generateJson<StoryboardReview>({
      systemPrompt: STORYBOARD_REVIEW_SYSTEM_PROMPT,
      userPayload,
      schemaName: "StoryboardReview",
      temperature: 0.2 // 低温度保证审核客观性
    });
  }
}

