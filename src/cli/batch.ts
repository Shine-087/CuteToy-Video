import { MockLLMClient, VolcengineClient } from "../core/llmClient.ts";
import { generateNextEpisode, commitEpisode } from "../core/orchestrator.ts";
import { logger } from "../core/logger.ts";
import { loadJson } from "../core/fileStore.ts";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import * as dotenv from "dotenv";

dotenv.config();

function createLLM() {
  if (process.env.LLM_PROVIDER === "doubao") {
    logger.info("Using Volcengine (Doubao) LLM Client");
    return new VolcengineClient(
      process.env.ARK_API_KEY || "",
      process.env.ARK_MODEL_ENDPOINT || ""
    );
  }
  logger.info("Using Mock LLM Client");
  return new MockLLMClient();
}

async function printEpisodeSummary(episodeDir: string, episodeId: string) {
  try {
    const brief = await loadJson(join(episodeDir, "episode_brief.json")) as any;
    const script = await loadJson(join(episodeDir, "script.json")) as any;

    console.log("\n" + "═".repeat(60));
    console.log(`  📺 ${episodeId} 生成完毕`);
    console.log("═".repeat(60));
    console.log(`  🎬 阶段: ${brief.arc_stage || "N/A"}`);
    console.log(`  📝 主题: ${brief.workplace_theme || "N/A"}`);
    console.log(`  🎯 关键情节: ${brief.required_plot_point || "N/A"}`);
    console.log("─".repeat(60));
    console.log(`  📖 剧本标题: ${script.title || "N/A"}`);
    console.log(`  💡 结尾梗: ${script.punchline || "N/A"}`);

    if (Array.isArray(script.beats)) {
      console.log(`  🎞️  镜头数: ${script.beats.length}`);
      for (const beat of script.beats) {
        console.log(`     [${beat.time_range}] ${beat.action}`);
        if (beat.dialogue) console.log(`       💬 ${beat.dialogue}`);
      }
    }

    console.log("─".repeat(60));
    console.log(`  🔚 结尾状态变化: ${brief.ending_state_change || "N/A"}`);
    console.log("═".repeat(60) + "\n");
  } catch {
    console.log(`\n  ⚠️  无法读取 ${episodeId} 的摘要文件，请手动检查 ${episodeDir}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const maxEpisodes = parseInt(args.find(a => a.startsWith("--count="))?.split("=")[1] || "10", 10);
  const projectRoot = process.cwd();
  const outputDir = process.env.OUTPUT_DIR ?? "episodes";
  const llm = createLLM();

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n🚀 捏捏有限公司 · 交互式批量生成模式");
  console.log(`   计划生成最多 ${maxEpisodes} 集。每集生成后您可以审核并决定是否继续。`);
  console.log("   操作指南: y=通过入库 | n=停止 | r=提出修改意见重新生成 | s=跳过\n");

  let generated = 0;

  try {
    while (generated < maxEpisodes) {
      // 检查当前进度
      const indexPath = join(projectRoot, "data", "series", "episode_index.json");
      const episodeIndex = await loadJson(indexPath) as { episodes: any[] };
      const totalPlanned = await loadJson(join(projectRoot, "data", "series", "season_01.json"))
        .then((s: any) => s.total_episodes_planned || 999);

      const completedCount = episodeIndex.episodes?.length || 0;
      if (completedCount >= totalPlanned) {
        console.log(`\n🎉 第一季全部 ${totalPlanned} 集已生成完毕！恭喜！\n`);
        break;
      }

      const nextNum = completedCount + 1;
      const episodeId = `E${String(nextNum).padStart(3, "0")}`;

      let humanFeedback: string | undefined = undefined;
      let approved = false;

      // 修改-重生成循环：同一集可以反复修改直到满意
      while (!approved) {
        if (humanFeedback) {
          console.log(`\n🔄 根据您的修改意见重新生成 ${episodeId}...\n`);
        } else {
          console.log(`\n⏳ 正在生成 ${episodeId} (${nextNum}/${totalPlanned})...\n`);
        }

        try {
          const result = await generateNextEpisode(llm, {
            projectRoot,
            outputDir,
            autoCommit: false,
            humanFeedback
          });

          await printEpisodeSummary(result.episodeDir, result.episodeId);

          // 交互式审核
          const answer = await rl.question("  👉 您的决定 (y=通过 / r=修改意见 / n=停止 / s=跳过): ");
          const choice = answer.trim().toLowerCase();

          if (choice === "y" || choice === "yes") {
            const proposedState = await loadJson(join(result.episodeDir, "proposed_state_change.json"));
            await commitEpisode(projectRoot, result.episodeId, proposedState);
            console.log(`  ✅ ${result.episodeId} 已入库！角色记忆已更新。\n`);
            generated++;
            approved = true;
          } else if (choice === "r" || choice.startsWith("r ") || choice === "revise") {
            // 收集修改意见
            console.log("\n  📝 请输入您的修改意见（输入完毕后按回车）:");
            console.log("     例如: '不要再重复奶盖压制团子的情节，换一个新的冲突方式'");
            const feedback = await rl.question("  💬 修改意见: ");
            if (feedback.trim()) {
              humanFeedback = feedback.trim();
              console.log(`\n  📋 已收到修改意见: "${humanFeedback}"`);
              // 不设 approved=true，循环会重新生成同一集
            } else {
              console.log("  ⚠️  未输入修改意见，将重新生成（无特殊指令）。");
              humanFeedback = undefined;
            }
          } else if (choice === "s" || choice === "skip") {
            console.log(`  ⏭️  ${result.episodeId} 已跳过（未入库），继续生成下一集...\n`);
            generated++;
            approved = true;
          } else {
            console.log(`\n  🛑 已停止。${result.episodeId} 的文件已保存在 ${result.episodeDir}，您可以稍后手动 commit。\n`);
            rl.close();
            return;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.error(`生成 ${episodeId} 失败`, { error: msg });
          const retry = await rl.question("  ❌ 生成失败。重试? (y=重试 / n=停止): ");
          if (retry.trim().toLowerCase() !== "y") {
            rl.close();
            return;
          }
        }
      }
    }
  } finally {
    rl.close();
  }

  console.log(`\n📊 本次批量生成结束。共处理 ${generated} 集。\n`);
}

main().catch((error) => {
  logger.error("Batch command failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
