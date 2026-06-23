# 开发分镜图提示词 Agent (StoryboardVisualAgent)

## Goal

实现技术方案中规划的 **第三层：视觉制作层（阶段 2）** 的首个核心功能：`StoryboardVisualAgent`。
它的核心作用是读取已经生成的终版文字剧本（`script.json`），结合全局视觉设定（`visual_style.json`）和各个角色的外貌模型（`characters.json`），自动为剧本的每一个镜头（Beat）生成**全中文的画面提示词（Image Prompt）**以及运镜指示，最终产出 `storyboard.json`。

## 生图提示词生成逻辑 (Prompt Logic)

针对您提出的问题，我们对大模型的 Prompt 逻辑进行更深度的设计，使其不再是粗糙的“词汇翻译”或“死板的公式拼凑”，而是像一位真正的“AI 摄影指导”一样去构建画面。

大模型生成提示词时，将围绕以下 5 个核心维度（Ingredient），但**完全打破固定的顺序限制，根据当前镜头的剧情重点灵活组织语言**：

1. **画面风格与质感的具象化（不再是空洞词汇）**：
   - 比如 `visual_style.json` 中的“kawaii toy photography”和“soft silicone texture”，大模型不会直接输出“可爱玩具摄影风格”，而是将其展开为具体的视觉描述：“画面呈现微距摄影的浅景深效果，聚焦于角色的细节；光线采用柔和的漫反射打光，没有生硬的阴影，完美凸显出角色表面哑光、Q弹、如同软硅胶一般的质感。”
2. **角色外观的精准还原**：
   - 根据 `characters.json` 的 `key_features` 进行白话文描述，例如：“一只圆滚滚的白色猫咪玩具，头顶有一块淡黄色的奶油花纹，豆豆眼正心虚地看着前方。”
3. **镜头景别与构图**：
   - 由 Agent 判断当前的情节重点（如：全景展现办公室、近景展现冲突、特写展现委屈）。
4. **具体动作与神态（物理层面的客观描述）**：
   - 将文字剧本中的抽象动作转化为具象画面。例如将“反抗主管”转化为“小熊玩具正举起短短的前肢，试图推开面前巨大的猫咪，猫咪的身体因为挤压而微微变形”。
5. **背景环境**：
   - 提取剧情发生的场地，并补充微型玩具世界的道具细节（如“背景是一张干净明亮的办公桌，旁边放着巨大的马克杯和笔筒”）。

> **灵活排布的组合逻辑**：
> 5 个维度是配料，顺序由“剧情的聚焦点”决定。例如：
> - **如果这是一个开场镜头（重环境）**：“在一个光线柔和、充满微距摄影质感的干净办公桌上，坐着一只圆滚滚的白色硅胶猫咪玩具……”（环境 -> 质感 -> 角色 -> 动作）
> - **如果这是一个冲突特写（重动作）**：“特写镜头！白色猫咪玩具的整个身体被一双大手死死按在桌面上，硅胶质感被压得严重变形。旁边一只米色小熊玩具正努力伸出短短的手臂试图阻拦……”（景别 -> 动作 -> 角色 -> 质感 -> 环境补充）

大模型将输出一段如上所示、连贯且主次分明的全中文描述，最大化激活 GPT-5.5 的自然语言图像生成潜力。

## Proposed Changes

### 1. Schemas 架构层
#### [NEW] `src/schemas/visual.schema.ts`
新建视觉数据结构的 Zod 校验定义，包含：
- `StoryboardShotSchema`：单个镜头包含 `shot_id`, `camera_shot_type`, `image_prompt` (全中文), `action_description`, `dialogue`。
- `StoryboardSchema`：单集的完整分镜数组。
- `StoryboardReviewSchema`：分镜审核结果，包含 `decision` (`pass` | `revise`) 和 `feedback`。

### 2. Prompts 提示词层
#### [NEW] `src/prompts/storyboardVisual.prompt.ts`
编写专门的分镜翻译 Prompt，教导大模型严格遵循上述的“生图提示词生成逻辑”公式，并特别强调**全部输出中文**。
#### [NEW] `src/prompts/storyboardReview.prompt.ts`
编写分镜审核 Prompt，充当“视觉品控官”，对照原版剧本检查：
- 提示词是否幻觉加戏（多出了原本没有的动作或角色）。
- 是否违背了视觉设定的“负面限制”（例如出现了血腥或真实动物特征）。
- 空间连贯性是否一致。

### 3. Agents 逻辑层
#### [NEW] `src/agents/storyboardVisualAgent.ts`
实现 `StoryboardVisualAgent` 类，负责输出初稿分镜提示词。
#### [NEW] `src/agents/storyboardReviewAgent.ts`
实现 `StoryboardReviewAgent` 类，负责读取分镜初稿和原剧本，给出审核意见。

### 4. Core & CLI 调度层 (解耦独立命令)
#### [NEW] `src/core/visualOrchestrator.ts`
新增视觉层的调度器 `generateVisualsForEpisode`。调度逻辑包含一个**闭环审核链路**：
1. 调用 `StoryboardVisualAgent` 生成分镜提示词。
2. 调用 `StoryboardReviewAgent` 审核提示词。
3. 如果审核判定为 `revise`，则携带修改意见反馈给 Visual Agent 重写。
4. 审核通过 (`pass`) 后，最终保存 `storyboard.json` 和 `storyboard_review.json`。
#### [NEW] `src/cli/visual.ts`
新增独立 CLI 命令入口。
#### [MODIFY] `package.json`
增加 `"visual": "node --experimental-strip-types src/cli/visual.ts"` 命令，允许用户通过 `npm run visual E005` 进行独立生成。

## Verification Plan
1. 运行 `npm run visual E005`。
2. 检查 `episodes/E005/storyboard.json`，验证 `image_prompt` 是否是一段结构清晰、包含角色特征和动作的**全中文描述**。
