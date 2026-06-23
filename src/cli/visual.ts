import { resolve } from "node:path";
import { config } from "dotenv";
import { MockLLMClient, VolcengineClient, GeminiClient } from "../core/llmClient.ts";
import { generateVisualsForEpisode } from "../core/visualOrchestrator.ts";
import { logger } from "../core/logger.ts";

config();

async function main() {
  const args = process.argv.slice(2);
  const episodeId = args[0];

  if (!episodeId) {
    logger.error("Please specify an episode ID. Usage: npm run visual E005");
    process.exit(1);
  }

  let llm;
  if (process.env.LLM_PROVIDER === "doubao") {
    llm = new VolcengineClient(
      process.env.ARK_API_KEY || "",
      process.env.ARK_MODEL_ENDPOINT || ""
    );
    logger.info("Using Volcengine (Doubao) LLM Client");
  } else if (process.env.LLM_PROVIDER === "gemini") {
    llm = new GeminiClient(
      process.env.GEMINI_API_KEY || "",
      process.env.GEMINI_MODEL || "gemini-2.5-flash"
    );
    logger.info(`Using Gemini LLM Client (${process.env.GEMINI_MODEL || "gemini-2.5-flash"})`);
  } else {
    llm = new MockLLMClient();
    logger.info("Using Mock LLM Client");
  }

  const projectRoot = resolve(process.cwd());

  try {
    await generateVisualsForEpisode(llm, {
      projectRoot,
      episodeId
    });
  } catch (error) {
    logger.error(`Generation failed: ${error}`);
    process.exit(1);
  }
}

main();
