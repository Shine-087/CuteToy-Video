# AI Squishy Agent 项目代码规范与风格指南

本文档旨在统一《捏捏有限公司》多智能体系统的代码风格，确保项目在长期连载和多人协作维护时保持高可读性和一致性。

## 1. 语言与基础规范
- **开发语言**：严格使用 TypeScript。
- **目标运行环境**：Node.js (>= 18.x)。
- **包管理器**：pnpm。

## 2. 命名规范
- **文件命名**：使用 `camelCase.ts`（小驼峰），与现有的 `writerAgent.ts` 保持一致。
  - 组件/类导出文件：`orchestrator.ts`
  - 接口/类型定义：可以集中在 `schemas/` 下，使用 `.schema.ts`（如 `script.schema.ts`）。
  - Prompt 定义：使用 `.prompt.ts` 后缀（如 `writer.prompt.ts`）。
- **变量与函数**：使用 `camelCase`（小驼峰）。例如 `generateScript`、`characterState`。
- **类名与接口名**：使用 `PascalCase`（大驼峰）。例如 `WriterAgent`、`LLMClient`、`CharacterState`。
- **常量与枚举**：使用全大写加下划线 `UPPER_SNAKE_CASE`。例如 `MAX_RETRIES`、`DEFAULT_TEMPERATURE`。
- **Zod Schemas**：首字母大写并以 `Schema` 结尾。例如 `ScriptSchema`、`EpisodeBriefSchema`。

## 3. 代码格式化与 Lint
- **格式化工具**：推荐使用 Prettier。建议配置统一缩进和引号。
- **类型检查**：不允许使用 `any`，实在无法推断的类型请使用 `unknown` 并配合 Zod 校验，或使用具体的 `interface/type`。

## 4. 架构与依赖隔离
- **解耦 LLM**：具体的 Agent 业务逻辑（如 `writerAgent.ts`）**不允许**直接引入 `openai` 等特定厂商的 SDK。必须通过抽象的 `LLMClient` 接口进行调用，以便未来无缝切换模型（如切换到 Claude 或 DeepSeek）。
- **纯函数优先**：数据处理逻辑（如拼装 Prompt、提取 JSON）尽量写成纯函数，方便独立进行单元测试。

## 5. 数据结构与校验 (Zod)
- **强校验策略**：所有大模型的 JSON 输出**必须**经过 Zod schema 校验。
- **错误处理**：如果 Zod 校验失败，应当捕获错误，并将具体的验证失败信息反馈给 LLM 进行重试修复（Retry Loop）。

## 6. 异步与错误处理
- **Async/Await**：优先使用 `async/await` 处理异步操作，避免使用原始的 `.then().catch()` 链。
- **统一错误捕获**：在 Agent 的顶层方法或 Orchestrator 层使用 `try/catch`，不要在底层的工具函数中吞掉错误。
- **自定义错误类**：对于可预见的业务错误（如重试次数耗尽、API Key 缺失），建议抛出明确定义的自定义错误（如 `LLMGenerationError`）。

## 7. 日志规范 (Logger)
- 避免在生产代码中使用 `console.log`。使用统一的 `logger.ts`（支持 info, warn, error, debug 级别）。
- 关键操作必须打日志：
  - 开始调用某个 Agent 时。
  - LLM 返回结果解析成功/失败时。
  - 发生重试时。
  - 关键状态文件（如 `character_state.json`）更新时。

## 8. 注释规范
- **JSDoc**：为核心类、复杂接口和业务逻辑复杂的函数添加 JSDoc 注释。
- **代码内注释**：主要解释“为什么这么做”（Why），而不是“这是什么代码”（What）。

## 9. 状态管理安全 (本项目特有)
- **状态不污染原则**：在整个单集流水线未完全审核通过之前，严禁直接覆盖 `data/series/character_state.json` 等全局状态文件。应当先生成临时草案，在流水线最后一步（或人工审批后）再进行状态合并（Commit）。
