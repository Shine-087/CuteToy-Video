import type { LLMClient } from "../core/llmClient.ts";
import type { Storyboard } from "../schemas/visual.schema.ts";
import type { PreviousEpisodeContext } from "../core/visualOrchestrator.ts";
import { STORYBOARD_VISUAL_SYSTEM_PROMPT } from "../prompts/storyboardVisual.prompt.ts";

export interface StoryboardVisualInput {
  episodeId: string;
  script: unknown;
  visualStyle: unknown;
  charactersConfig: unknown;
  previousEpisodeContext?: PreviousEpisodeContext | null;
  humanFeedback?: string;
}

export class StoryboardVisualAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async generateStoryboard(input: StoryboardVisualInput): Promise<Storyboard> {
    let systemPrompt = STORYBOARD_VISUAL_SYSTEM_PROMPT;

    if (input.humanFeedback) {
      systemPrompt += `\n\n【修改反馈】上级审核或人类导演指出了以下问题，请你必须在重写时解决：\n${input.humanFeedback}`;
    }

    const userPayload: Record<string, unknown> = {
      episodeId: input.episodeId,
      script: input.script,
      visualStyle: input.visualStyle,
      charactersConfig: input.charactersConfig
    };

    if (input.previousEpisodeContext) {
      userPayload.previousEpisodeContext = input.previousEpisodeContext;
    }

    return this.llm.generateJson<Storyboard>({
      systemPrompt,
      userPayload,
      schemaName: "Storyboard",
      temperature: 0.7
    });
  }
}

