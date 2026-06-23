import type { LLMClient } from "../core/llmClient.ts";
import type { EpisodeBrief } from "../schemas/series.schema.ts";
import { SERIES_PLANNER_SYSTEM_PROMPT } from "../prompts/seriesPlanner.prompt.ts";

export interface SeriesPlannerInput {
  world: unknown;
  characters: unknown;
  seasonPlan: unknown;
  episodeIndex: unknown;
  narrativeBible: unknown;
  recentEpisodes?: Array<{ episodeId: string; brief: unknown; scriptSummary: unknown }>;
  humanFeedback?: string;
}

export class SeriesPlannerAgent {
  private llm: LLMClient;

  constructor(llm: LLMClient) {
    this.llm = llm;
  }

  async generateNextEpisodeBrief(input: SeriesPlannerInput): Promise<EpisodeBrief> {
    let systemPrompt = SERIES_PLANNER_SYSTEM_PROMPT;

    // 注入近期剧集摘要，防止剧情重复
    if (input.recentEpisodes && input.recentEpisodes.length > 0) {
      const summaries = input.recentEpisodes.map(ep =>
        `- ${ep.episodeId}: ${JSON.stringify(ep.brief)}`
      ).join("\n");
      systemPrompt += `\n\n【近期已生成的剧集摘要】以下是最近几集的内容，你必须避免与它们的主题、情节或笑点重复：\n${summaries}`;
    }

    // 注入人类导演的修改意见
    if (input.humanFeedback) {
      systemPrompt += `\n\n【人类导演反馈】以下是导演对本集的具体要求，你必须严格遵循：\n${input.humanFeedback}`;
    }

    return this.llm.generateJson<EpisodeBrief>({
      systemPrompt,
      userPayload: {
        world: input.world,
        characters: input.characters,
        seasonPlan: input.seasonPlan,
        episodeIndex: input.episodeIndex,
        narrativeBible: input.narrativeBible
      },
      schemaName: "EpisodeBrief",
      temperature: 0.7
    });
  }
}
