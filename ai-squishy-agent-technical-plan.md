# 捏捏有限公司：全 AI 驱动的职场短剧 8-Agent 连载生产系统

## 1. 项目愿景与连载哲学

本项目旨在构建一个完全由 AI 驱动的短视频生产流水线，核心内容方向为：**可爱捏捏外壳 + 职场荒诞短剧**。

### 为什么必须要做“Series (连载系统)”？
在传统的 AI 短剧生成中，故事往往是“单元剧”：角色在每一集之间都会“失忆”，今天挨骂明天照旧，剧情无法向前推进。
连载系统的核心用处是：**赋予系统时间线和长线记忆。**
- 宏观：通过 `season_01.json` 图纸，设定一整季的大结局目标。
- 微观：通过 `character_state.json`，记录角色在每一集里学到的教训和累积的记仇。
- 最终将散落的每日段子串联成一部真正有起承转合的连续剧。

## 2. 系统目录结构与数据设计

系统采用严格的 JSON 文件来维护世界观与状态。

### 2.1 推荐目录结构

```text
squishy-workplace/
  .env
  package.json
  
  data/
    bible/                   # 静态设定圣经（不会随剧集改变）
      world.json             # 整体世界观规则
      characters.json        # 所有角色基础设定
      content_rules.json     # 剧本台词/内容合规限制
      visual_style.json      # 视觉提示词全局风格限制
    series/                  # 动态连载数据库（随着剧集推进而改变）
      season_01.json         # 第一季的总体规划
      episode_index.json     # 剧集播出目录与状态跟踪
      character_state.json   # 角色动态关系与记忆图谱

  src/
    agents/                  # 8大核心Agent类
    core/                    # 底层基建 (llmClient, orchestrator, fileStore等)
    schemas/                 # Zod 数据校验层
    prompts/                 # 独立分离的提示词模板
    cli/                     # 命令行入口

  episodes/                  # 剧集生成产物
    E001/
      episode_brief.json     # 本集具体任务
      script_candidates.json # 变体剧本候选池
      script.json            # 最终获胜剧本
      continuity_review.json # 连贯性审核结果
      review.json            # 质量审核结果
      proposed_state_change.json # 等待人工Commit的动态记忆更新
```

### 2.2 核心配置文件设计

- **`content_rules.json`**:
规定 `max_dialogue_chars_per_line`（已放宽至 40）、`max_beats`（最多 5 镜）、以及一系列红线（forbidden）。这些是 Zod 校验规则的基准。
- **`character_state.json`**:
存储每个角色的 `current_mindset`（当前心态）、`dynamic_relationships`（动态关系）和 `recent_memories`（近期记忆）。

## 3. 核心架构：四层 8-Agent 详细接口设计

整个系统共 8 个专职 Agent，目前第一阶段启用了连载层与文本层的 5 个。

### 第一层：连载层 (Series Layer) - “导演组与场记”

#### 3.1 连载规划 Agent (`SeriesPlannerAgent`)
- **职责**：承上启下，决定本集具体情节。扮演包工头，不写具体台词，只下发任务。
- **输入**：`season_01.json`, `character_state.json`, `episode_index.json`
- **输出**：`episode_brief.json`
- **输出字段核心**：`episode_function` (本集作用), `required_plot_point` (必须出现的剧情点), `ending_state_change` (结尾角色状态的变化预期)。

#### 3.2 状态管理 Agent (`StateManagerAgent`)
- **职责**：在剧本最终确定后，从剧本中提取角色的认知变化和关系转变，沉淀为新的角色状态。
- **输入**：`script.json` (最终获胜剧本), `character_state.json` (当前状态)
- **输出**：`proposed_state_change.json`

### 第二层：文本层 (Text Layer) - “编剧部与质检”

#### 3.3 编剧 Agent (`WriterAgent`)
- **职责**：根据具体的 `episode_brief`，进行严格的命题作文，脑暴出 3 份台词或表现形式不同的剧本变体。
- **输入**：`episode_brief.json`, `content_rules.json`, `characters.json`
- **输出**：`script_candidates.json` (包含 3 个剧本变体的数组)
- **输出字段核心**：`beats` (动作与台词的拆解), `punchline` (核心结尾梗)。

#### 3.4 连贯性审核 Agent (`ContinuityReviewAgent`)
- **职责**：审查剧本有没有搞错上下集逻辑，有没有把人设写崩，是否完成了 brief 的要求。
- **输入**：`script_candidates.json` 中的单项, `episode_brief.json`, `character_state.json`
- **输出**：`continuity_review.json`
- **状态枚举**：`decision` 只能是 `"pass" | "revise" | "reject"`。

#### 3.5 质量审核 Agent (`QualityReviewAgent`)
- **职责**：审查剧本好不好笑、台词够不够短、有没有踩到红线（如角色超载、视觉风险等）。
- **输入**：通过了连贯性审核的剧本。
- **输出**：`review.json`
- **状态枚举**：`recommended_next_action` 只能是 `"use_as_script" | "revise_script" | "reject_script"`。

### 第三层：视觉制作层 (Visual Layer) - (阶段 2)

#### 3.6 分镜视觉 Agent (`StoryboardVisualAgent`)
- **职责**：将文字剧本转化为可以直接调用大模型的图片/视频提示词。
- **输入**：`script.json`, `visual_style.json`
- **输出**：`storyboard.json` (镜头拆分), `prompts.json` (中英文对照的提示词工程文件)。

#### 3.7 资产后期 Agent (`AssetGeneratorAgent`)
- **职责**：调用图像、视频大模型 API、TTS 语音引擎生成资源，并生成基础的剪辑时间线。
- **输入**：`storyboard.json`, `prompts.json`
- **输出**：`.mp4` 素材, `.wav` 音频, `timeline.json`

### 第四层：成片质检层 (QA Layer) - (阶段 3)

#### 3.8 成片审核 Agent (`FinalReviewAgent`)
- **职责**：作为视觉闭环的最后防线，检查穿帮、口型对齐、字幕遮挡等物理问题。
- **输出**：`final_review.json`

## 4. 主控程序 (Orchestrator) 调度流程

Orchestrator (`src/core/orchestrator.ts`) 并非大模型，而是流水线的履带。其执行伪代码逻辑如下：

```typescript
async function generateNextEpisode() {
  // 1. 加载所有前置上下文 (Bible & Series)
  const context = await loadContext();
  
  // 2. 连载导演下发任务
  const brief = await plannerAgent.generateBrief(context);
  
  // 3. 编剧撰写 3 个变体
  const candidates = await writerAgent.generate(brief);
  
  let selectedScript = null;
  // 4. 审核漏斗：依次检查 3 个剧本
  for (const script of candidates.scripts) {
     const contReview = await continuityReviewAgent.review(script);
     if (contReview.decision === "pass") {
         const qualReview = await qualityReviewAgent.review(script);
         if (qualReview.decision === "pass") {
             selectedScript = script; // 找到第一个完美的剧本，跳出循环
             break;
         }
     }
  }
  
  // 5. 生成记忆草稿
  const stateUpdate = await stateManagerAgent.updateState(selectedScript);
  
  // 6. 等待人工 Commit 或直接并入
  if (autoCommit) {
     commitEpisode(stateUpdate);
  }
}
```

## 5. 健壮性基建与容错机制

在第一阶段的实战开发中，我们形成了以下核心技术规范：

### 5.1 Zod Schema 强校验引擎
所有 Agent 的返回结果必须经过 `zod` 或自定义业务函数的极强校验。若校验失败，代码直接向外抛出 Error。

### 5.2 Auto-Retry 自动修复机制
底层封装了 `retry` 模块。当 Zod 校验失败（如“漏了字段”、“台词超长”）时，Orchestrator 会自动捕获报错，将 `validationError` 贴在报错前缀中再次发回大模型，要求其只修正格式错误，不改变创意（最多重试 2 次）。

### 5.3 提示词防撞车设计
对于状态机的枚举字段（如 `decision` 的三个固定值），不仅在 Zod 中校验，还在 `SystemPrompt` 中施加 `【重要约束】` 级别的高亮警告。对于长度限制，从过于严格的 18 字放宽到了 40 字，以顺应 LLM 中文分词习惯。

### 5.4 LLM Client 抽象化
业务 Agent 不直接引入外部 SDK，全部依赖 `LLMClient` 接口的 `generateJson()`。目前通过 `openai` 标准 SDK 无缝接入了**火山引擎（豆包大模型）**。未来仅需修改 `.env` 即可一秒切换回原生 OpenAI 或 DeepSeek。
