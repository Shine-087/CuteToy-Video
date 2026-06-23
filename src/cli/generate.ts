import { MockLLMClient, VolcengineClient } from "../core/llmClient.ts";
import { generateNextEpisode, commitEpisode } from "../core/orchestrator.ts";
import { logger } from "../core/logger.ts";
import { loadJson } from "../core/fileStore.ts";
import { join } from "node:path";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || "generate";

  if (command === "generate") {
    let llm;
    if (process.env.LLM_PROVIDER === "doubao") {
      llm = new VolcengineClient(
        process.env.ARK_API_KEY || "",
        process.env.ARK_MODEL_ENDPOINT || ""
      );
      logger.info("Using Volcengine (Doubao) LLM Client");
    } else {
      llm = new MockLLMClient();
      logger.info("Using Mock LLM Client");
    }
    
    // Default to autoCommit false as per coding guidelines, unless --auto-commit is passed
    const autoCommit = args.includes("--auto-commit");
    
    logger.info(`Starting generation pipeline. Auto-commit: ${autoCommit}`);
    const result = await generateNextEpisode(llm, {
      projectRoot: process.cwd(),
      outputDir: process.env.OUTPUT_DIR ?? "episodes",
      autoCommit
    });

    logger.info("Generate command completed", result);
  } else if (command === "commit") {
    const episodeId = args[1];
    if (!episodeId) throw new Error("Must provide an episodeId to commit, e.g. pnpm run generate commit E001");
    
    const projectRoot = process.cwd();
    const episodeDir = join(projectRoot, process.env.OUTPUT_DIR ?? "episodes", episodeId);
    const proposedState = await loadJson(join(episodeDir, "proposed_state_change.json"));
    
    await commitEpisode(projectRoot, episodeId, proposedState);
  }
}

main().catch((error) => {
  logger.error("Command failed", {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exitCode = 1;
});
