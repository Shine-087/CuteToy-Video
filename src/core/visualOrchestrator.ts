import { join } from "node:path";
import { existsSync } from "node:fs";
import type { LLMClient } from "./llmClient.ts";
import { loadJson, saveJson } from "./fileStore.ts";
import { logger } from "./logger.ts";
import { StoryboardVisualAgent } from "../agents/storyboardVisualAgent.ts";
import { StoryboardReviewAgent } from "../agents/storyboardReviewAgent.ts";

export interface PreviousEpisodeContext {
  previousEpisodeId: string;
  lastShotImagePrompt: string;
  lastBeatAction: string;
  lastBeatDialogue: string;
}

export interface GenerateVisualsOptions {
  projectRoot: string;
  episodeId: string;
  outputDir?: string;
}

/**
 * 根据当前 episodeId (如 "E005") 计算上一集 ID (如 "E004")，
 * 并尝试读取上一集的 storyboard.json 和 script.json 的最后一镜/最后一个 beat。
 * 如果上一集不存在或缺少文件，返回 null（优雅降级）。
 */
async function loadPreviousEpisodeContext(
  projectRoot: string,
  episodeId: string,
  outputDir: string
): Promise<PreviousEpisodeContext | null> {
  const match = episodeId.match(/^E(\d{3})$/);
  if (!match) return null;

  const currentNum = parseInt(match[1], 10);
  if (currentNum <= 1) {
    logger.info(`${episodeId} is the first episode, no previous context available.`);
    return null;
  }

  const prevId = `E${String(currentNum - 1).padStart(3, "0")}`;
  const prevDir = join(projectRoot, outputDir, prevId);

  const prevStoryboardPath = join(prevDir, "storyboard.json");
  const prevScriptPath = join(prevDir, "script.json");

  if (!existsSync(prevStoryboardPath) || !existsSync(prevScriptPath)) {
    logger.info(`Previous episode ${prevId} is missing storyboard or script, skipping context.`);
    return null;
  }

  try {
    const prevStoryboard = await loadJson(prevStoryboardPath) as any;
    const prevScript = await loadJson(prevScriptPath) as any;

    // 提取上一集最后一个镜头的 image_prompt
    const shots = prevStoryboard.storyboard || prevStoryboard.shots || [];
    const lastShot = shots.length > 0 ? shots[shots.length - 1] : null;
    const lastShotImagePrompt = lastShot?.image_prompt || "";

    // 提取上一集最后一个 beat 的 action 和 dialogue
    const beats = prevScript.beats || [];
    const lastBeat = beats.length > 0 ? beats[beats.length - 1] : null;
    const lastBeatAction = lastBeat?.action || "";
    const lastBeatDialogue = lastBeat?.dialogue || "";

    if (!lastShotImagePrompt) {
      logger.info(`Previous episode ${prevId} storyboard has no shots, skipping context.`);
      return null;
    }

    logger.info(`Found previous episode context from ${prevId}.`);
    return {
      previousEpisodeId: prevId,
      lastShotImagePrompt,
      lastBeatAction,
      lastBeatDialogue
    };
  } catch (e) {
    logger.warn(`Failed to load previous episode context from ${prevId}: ${e}`);
    return null;
  }
}

export async function generateVisualsForEpisode(llm: LLMClient, options: GenerateVisualsOptions) {
  const outputDir = options.outputDir ?? "episodes";
  const episodeDir = join(options.projectRoot, outputDir, options.episodeId);
  const bibleDir = join(options.projectRoot, "data", "bible");

  logger.info(`Starting visual generation for ${options.episodeId}`);

  let script: any;
  try {
    script = await loadJson(join(episodeDir, "script.json"));
  } catch (e) {
    logger.error(`Could not find script.json for ${options.episodeId}. Has it been generated?`);
    throw e;
  }

  const visualStyle = await loadJson(join(bibleDir, "visual_style.json"));
  const charactersConfig = await loadJson(join(bibleDir, "characters.json"));

  // 加载上一集的视觉交接上下文
  const previousEpisodeContext = await loadPreviousEpisodeContext(
    options.projectRoot,
    options.episodeId,
    outputDir
  );

  const visualAgent = new StoryboardVisualAgent(llm);
  const reviewAgent = new StoryboardReviewAgent(llm);

  let attempts = 0;
  const maxAttempts = 3;
  let currentFeedback = "";
  
  let finalStoryboard: any = null;
  let finalReview: any = null;

  while (attempts < maxAttempts) {
    attempts++;
    logger.info(`Generating storyboard... (Attempt ${attempts}/${maxAttempts})`);
    
    const storyboard = await visualAgent.generateStoryboard({
      episodeId: options.episodeId,
      script,
      visualStyle,
      charactersConfig,
      previousEpisodeContext,
      humanFeedback: currentFeedback ? `【此前审核未通过意见】\n${currentFeedback}` : undefined
    });

    logger.info(`Reviewing generated storyboard...`);
    const review = await reviewAgent.reviewStoryboard({
      storyboard,
      script,
      visualStyle,
      previousEpisodeContext
    });

    if (review.decision === "pass") {
      logger.info(`Storyboard passed QA review!`);
      finalStoryboard = storyboard;
      finalReview = review;
      break;
    } else {
      logger.warn(`Storyboard QA failed: ${review.feedback}`);
      currentFeedback = review.feedback;
      if (review.violating_shot_ids && review.violating_shot_ids.length > 0) {
         currentFeedback += `\n(主要违规镜头: ${review.violating_shot_ids.join(", ")})`;
      }
    }
  }

  if (!finalStoryboard) {
    logger.error(`Failed to generate a passing storyboard after ${maxAttempts} attempts.`);
    throw new Error("Storyboard generation failed QA too many times.");
  }

  await saveJson(join(episodeDir, "storyboard.json"), finalStoryboard);
  await saveJson(join(episodeDir, "storyboard_review.json"), finalReview);
  
  logger.info(`Visual generation completed for ${options.episodeId}.`);
  return { storyboard: finalStoryboard, review: finalReview };
}

