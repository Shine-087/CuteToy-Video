import { resolve, join } from "node:path";
import { readdirSync, existsSync } from "node:fs";
import { config } from "dotenv";
import { createInterface } from "node:readline/promises";
import { MockLLMClient, VolcengineClient, GeminiClient } from "../core/llmClient.ts";
import { generateVisualsForEpisode } from "../core/visualOrchestrator.ts";
import { logger } from "../core/logger.ts";

config();

function createLLM() {
  if (process.env.LLM_PROVIDER === "doubao") {
    logger.info("Using Volcengine (Doubao) LLM Client");
    return new VolcengineClient(
      process.env.ARK_API_KEY || "",
      process.env.ARK_MODEL_ENDPOINT || ""
    );
  } else if (process.env.LLM_PROVIDER === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    logger.info(`Using Gemini LLM Client (${model})`);
    return new GeminiClient(
      process.env.GEMINI_API_KEY || "",
      model
    );
  }
  logger.info("Using Mock LLM Client");
  return new MockLLMClient();
}

async function main() {
  const projectRoot = resolve(process.cwd());
  const outputDir = process.env.OUTPUT_DIR ?? "episodes";
  const episodesPath = join(projectRoot, outputDir);

  if (!existsSync(episodesPath)) {
    logger.error(`Episodes directory not found: ${episodesPath}`);
    process.exit(1);
  }

  // 1. Scan for missing storyboards
  const subDirs = readdirSync(episodesPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && /^E\d{3}$/.test(dirent.name))
    .map(dirent => dirent.name)
    .sort();

  const missingEpisodes: string[] = [];

  for (const ep of subDirs) {
    const scriptExists = existsSync(join(episodesPath, ep, "script.json"));
    const storyboardExists = existsSync(join(episodesPath, ep, "storyboard.json"));
    
    if (scriptExists && !storyboardExists) {
      missingEpisodes.push(ep);
    }
  }

  console.log("\n🚀 捏捏有限公司 · 批量分镜图生成模式 (Batch Visual Generation)");
  console.log("═".repeat(60));
  
  if (missingEpisodes.length === 0) {
    console.log("✅ 扫描完毕：所有已存在的剧本均已配备分镜图，暂无需要生成的任务！\n");
    return;
  }

  console.log(`🔍 扫描完毕：发现 ${missingEpisodes.length} 集缺失分镜图。`);
  console.log(`📋 待生成队列: ${missingEpisodes.join(", ")}\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  
  try {
    const answer = await rl.question("  👉 是否现在开始批量自动生成？(y/n): ");
    if (answer.trim().toLowerCase() !== "y") {
      console.log("\n  🛑 用户取消批量生成。\n");
      return;
    }
  } finally {
    rl.close();
  }

  console.log("\n开始批量生成...\n");

  const llm = createLLM();
  let successCount = 0;
  let failCount = 0;

  for (const episodeId of missingEpisodes) {
    console.log("─".repeat(60));
    logger.info(`[${episodeId}] 正在处理...`);
    
    try {
      await generateVisualsForEpisode(llm, { projectRoot, episodeId, outputDir });
      successCount++;
      logger.info(`[${episodeId}] ✅ 分镜图生成并校验成功！`);
    } catch (error) {
      failCount++;
      const msg = error instanceof Error ? error.message : String(error);
      logger.error(`[${episodeId}] ❌ 生成失败，跳过该集。错误详情: ${msg}`);
      // 方案 A: 捕获错误并继续循环下一个
    }
  }

  console.log("\n" + "═".repeat(60));
  console.log(`📊 批量跑批完成！`);
  console.log(`   成功: ${successCount} 集`);
  console.log(`   失败: ${failCount} 集`);
  console.log("═".repeat(60) + "\n");
}

main().catch((error) => {
  logger.error("Batch visual command failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
