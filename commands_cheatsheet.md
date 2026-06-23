# 《捏捏有限公司》CLI 命令速查表 (Cheat Sheet)

本项目的所有自动化流水线操作均通过 `npm run` 指令触发。以下是目前可用的所有核心命令及说明：

## 1. 剧本生成层 (Text Layer)

### 1.1 生成单集剧本
生成“下一集”的完整剧本。系统会自动从 `data/series/episode_index.json` 读取当前进度，并生成对应的文件夹（如 `episodes/E006`）。
```bash
npm run generate
```
*(注意：此命令执行完后，默认不会立即修改“记忆库/设定圣经”，而是生成一份 `proposed_state_change.json` 供您人工审核。)*

### 1.2 带自动提交的剧本生成 (不推荐)
生成单集剧本，并在生成完毕后**自动采纳**记忆库的修改（跳过人工审核）。
```bash
npm run generate -- --auto-commit
```

### 1.3 采纳/提交剧情设定 (Commit)
人工检查完某集的剧本（如 E006）觉得没问题后，运行此命令将这集的动态记忆和金句正式存入 `narrative_bible.json`，确保下集能记住这集的剧情。
```bash
npm run generate commit E006
```

### 1.4 批量无人值守生成
自动化循环生成剧本流水线，不断根据目录表推演下一集（如遇报错会自动停止并输出日志）。非常适合夜间挂机跑批。
```bash
npm run batch
```

---

## 2. 视觉多模态层 (Visual Layer)

### 2.1 为单集生成分镜提示词
读取某集已写好的文字剧本（如 `E005/script.json`），结合全局视觉设定，调用大模型生成可以直接给生图工具用的全中文画面提示词，并自动进行防幻觉审核。
```bash
npm run visual E005
```
*(产物为：`episodes/E005/storyboard.json`)*

### 2.2 批量生成缺失的分镜提示词
自动扫描 `episodes` 目录下所有“已写好剧本”但“未生成分镜图”的剧集，并加入队列依次自动生成（具备错误容忍，单集报错自动跳过）。
```bash
npm run batch-visual
```

---

## 💡 环境变量 (.env) 快速切换技巧

如果需要切换底层调用的 AI 模型（比如由于网络超时或报错），您可以直接在项目根目录的 `.env` 文件中修改 `LLM_PROVIDER` 字段，**无需改动任何代码**即可无缝切换：

```env
# 切换为豆包 (国内速度快)
LLM_PROVIDER=doubao

# 切换为 Google Gemini (逻辑强，需科学上网)
LLM_PROVIDER=gemini
```
