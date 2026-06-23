import { join } from "node:path";
import type { LLMClient } from "./llmClient.ts";
import { ensureDir, loadJson, saveJson } from "./fileStore.ts";
import { logger } from "./logger.ts";
import { SeriesPlannerAgent } from "../agents/seriesPlannerAgent.ts";
import { WriterAgent } from "../agents/writerAgent.ts";
import { ContinuityReviewAgent } from "../agents/continuityReviewAgent.ts";
import { QualityReviewAgent } from "../agents/qualityReviewAgent.ts";
import { StateManagerAgent } from "../agents/stateManagerAgent.ts";

export interface GenerateNextEpisodeOptions {
  projectRoot: string;
  outputDir?: string;
  autoCommit?: boolean;
  humanFeedback?: string;
}

export async function generateNextEpisode(llm: LLMClient, options: GenerateNextEpisodeOptions) {
  const outputDir = options.outputDir ?? "episodes";
  const bibleDir = join(options.projectRoot, "data", "bible");
  const seriesDir = join(options.projectRoot, "data", "series");
  
  logger.info("Loading bible and series files");

  const world = await loadJson(join(bibleDir, "world.json"));
  const characters = await loadJson(join(bibleDir, "characters.json"));
  const contentRules = await loadJson(join(bibleDir, "content_rules.json"));
  const seasonPlan = await loadJson(join(seriesDir, "season_01.json"));
  const episodeIndex = await loadJson(join(seriesDir, "episode_index.json")) as { episodes: any[] };
  const narrativeBible = await loadJson(join(seriesDir, "narrative_bible.json"));

  const nextEpNum = (episodeIndex.episodes?.length || 0) + 1;
  const episodeId = `E${String(nextEpNum).padStart(3, "0")}`;
  const episodeDir = join(options.projectRoot, outputDir, episodeId);
  await ensureDir(episodeDir);

  // 加载最近 3 集的 brief 作为上下文，防止剧情重复
  const recentEpisodes: Array<{ episodeId: string; brief: unknown; scriptSummary: unknown }> = [];
  const lookback = Math.min(3, nextEpNum - 1);
  for (let i = nextEpNum - lookback; i < nextEpNum; i++) {
    const prevId = `E${String(i).padStart(3, "0")}`;
    const prevDir = join(options.projectRoot, outputDir, prevId);
    try {
      const prevBrief = await loadJson(join(prevDir, "episode_brief.json"));
      let prevScript: unknown = null;
      try {
        const s = await loadJson(join(prevDir, "script.json")) as any;
        prevScript = { title: s.title, logline: s.logline, punchline: s.punchline, workplace_theme: s.workplace_theme };
      } catch { /* script may not exist */ }
      recentEpisodes.push({ episodeId: prevId, brief: prevBrief, scriptSummary: prevScript });
    } catch { /* episode dir may not exist */ }
  }

  // 1. Series Planner
  logger.info(`Generating brief for ${episodeId}`);
  const planner = new SeriesPlannerAgent(llm);
  const brief = await planner.generateNextEpisodeBrief({
    world, characters, seasonPlan, episodeIndex, narrativeBible,
    recentEpisodes,
    humanFeedback: options.humanFeedback
  });
  await saveJson(join(episodeDir, "episode_brief.json"), brief);

  // 2. Writer
  logger.info(`Generating scripts for ${episodeId}`);
  const writer = new WriterAgent(llm);
  const scriptBatch = await writer.generate({
    world, characters: characters as any, contentRules: contentRules as any, narrativeBible, episodeBrief: brief
  });
  await saveJson(join(episodeDir, "script_candidates.json"), scriptBatch);

  // 3. Reviews (Continuity & Quality)
  logger.info(`Reviewing scripts for ${episodeId}`);
  const continuityReviewer = new ContinuityReviewAgent(llm);
  const qualityReviewer = new QualityReviewAgent(llm);
  
  let selectedScript = scriptBatch.scripts[0];
  let selectedContinuity = null;
  let selectedQuality = null;

  for (const script of scriptBatch.scripts) {
    const contReview = await continuityReviewer.reviewContinuity({
      script, seasonPlan, episodeIndex, narrativeBible, nextEpisodeBrief: brief
    });
    
    if (contReview.decision === "pass" || contReview.decision === "revise") {
        const qualReview = await qualityReviewer.reviewScripts({
            world, characters: characters as any, contentRules: contentRules as any, scriptBatch: { scripts: [script] }
        });
        
        selectedScript = script;
        selectedContinuity = contReview;
        selectedQuality = qualReview.reviews[0];
        if (qualReview.reviews[0]?.decision === "pass") break; // Stop at first good one
    }
  }

  await saveJson(join(episodeDir, "script.json"), selectedScript);
  if (selectedContinuity) await saveJson(join(episodeDir, "continuity_review.json"), selectedContinuity);
  if (selectedQuality) await saveJson(join(episodeDir, "review.json"), selectedQuality);

  // 4. State Manager (Proposed State Change)
  logger.info(`Generating state update for ${episodeId}`);
  const stateManager = new StateManagerAgent(llm);
  const stateUpdate = await stateManager.updateState({
    charactersConfig: characters, currentNarrativeBible: narrativeBible, episodeScript: selectedScript, episodeBrief: brief
  });
  await saveJson(join(episodeDir, "proposed_state_change.json"), stateUpdate);

  // 5. Commit State
  if (options.autoCommit) {
      await commitEpisode(options.projectRoot, episodeId, stateUpdate);
  } else {
      logger.info(`Skipping auto-commit for ${episodeId}. State changes are proposed but not merged.`);
  }

  return { episodeId, episodeDir };
}

export async function commitEpisode(projectRoot: string, episodeId: string, stateUpdate: any) {
    const seriesDir = join(projectRoot, "data", "series");
    
    // Update narrative bible
    await saveJson(join(seriesDir, "narrative_bible.json"), stateUpdate.updated_narrative_bible);
    
    // Update index
    const indexPath = join(seriesDir, "episode_index.json");
    const index = await loadJson(indexPath) as { episodes: any[] };
    index.episodes.push({
        id: episodeId,
        status: "completed",
        committed_at: new Date().toISOString()
    });
    await saveJson(indexPath, index);
    
    logger.info(`Committed state for ${episodeId}`);
}
