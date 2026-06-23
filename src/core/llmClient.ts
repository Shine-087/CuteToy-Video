import OpenAI from "openai";

export interface GenerateJsonParams {
  systemPrompt: string;
  userPayload: unknown;
  schemaName: string;
  temperature?: number;
}

export interface LLMClient {
  generateJson<T>(params: GenerateJsonParams): Promise<T>;
}

export class MockLLMClient implements LLMClient {
  async generateJson<T>(params: GenerateJsonParams): Promise<T> {
    if (params.schemaName === "ScriptBatch") {
      return createMockScriptBatch(params.userPayload) as T;
    }

    if (params.schemaName === "ScriptReviewBatch") {
      return createMockScriptReviewBatch(params.userPayload) as T;
    }

    if (params.schemaName === "EpisodeBrief") {
      return {
        episode_id: "E001",
        arc_stage: "起步",
        episode_function: "引入角色冲突",
        required_plot_point: "团子发现异常",
        characters: ["manager_cat", "new_bear"],
        workplace_theme: "新人入职",
        continuity_notes: [],
        ending_state_change: "团子开始怀疑"
      } as unknown as T;
    }

    if (params.schemaName === "ContinuityReview") {
      return {
        decision: "pass",
        checks: { connects_to_previous: true, completes_episode_function: true, relationship_logical: true, no_major_conflicts: true },
        problems: [],
        revision_notes: []
      } as unknown as T;
    }

    if (params.schemaName === "NarrativeBibleUpdate") {
      return {
        updated_narrative_bible: {
          updated_at: new Date().toISOString(),
          series_metadata: { total_seasons: 1, current_season: 1 },
          seasons: [],
          characters: []
        },
        continuity_warnings: []
      } as unknown as T;
    }

    if (params.schemaName === "Storyboard") {
      return {
        episode_id: "E000",
        generated_at: new Date().toISOString(),
        shots: []
      } as unknown as T;
    }

    if (params.schemaName === "StoryboardReview") {
      return {
        decision: "pass",
        feedback: "Mock passed."
      } as unknown as T;
    }

    const payload = {
      provider: "mock",
      schema_name: params.schemaName,
      generated_at: new Date().toISOString(),
      model_note: "Milestone 1 mock output. No external model API was called.",
      request_summary: summarizePayload(params.userPayload),
      sample: {
        title: "基础工程连通测试",
        message: "MockLLMClient 已成功接收 bible 数据并返回结构化 JSON。"
      }
    };

    return payload as T;
  }
}

function createMockScriptReviewBatch(payload: unknown) {
  const scripts = readNestedArray(payload, ["scriptBatch", "scripts"]);
  const reviews = scripts.map((script, index) => {
    const record = script as Record<string, unknown>;
    const scriptId = readString(record, "script_id") ?? `idea_${String(index + 1).padStart(3, "0")}`;
    const theme = readString(record, "workplace_theme") ?? "";
    const title = readString(record, "title") ?? "";
    const punchline = readString(record, "punchline") ?? "";
    const beats = Array.isArray(record.beats) ? record.beats : [];
    const hasPunchline = punchline.trim().length > 0;
    const duration = readNumber(record, "duration_target_seconds") ?? 0;
    const durationOk = duration >= 10 && duration <= 15;
    const dialogueShortEnough = beats.every((beat) => {
      if (!beat || typeof beat !== "object") {
        return false;
      }

      const dialogue = (beat as Record<string, unknown>).dialogue;
      return typeof dialogue === "string" && Array.from(dialogue.replace(/\s/g, "")).length <= 18;
    });
    const visualRisk = theme === "背锅" ? "medium" : "low";
    const comedy = scoreComedy(theme, title);
    const visualFeasibility = visualRisk === "low" ? 88 : 74;
    const characterFit = theme === "新人入职" || theme === "绩效" ? 92 : 86;
    const seriesConsistency = 88;
    const overallScore = Math.round((comedy + visualFeasibility + characterFit + seriesConsistency) / 4);
    const passes = durationOk && hasPunchline && dialogueShortEnough && overallScore >= 80;

    return {
      script_id: scriptId,
      overall_score: overallScore,
      decision: passes ? "pass" : "revise",
      checks: {
        duration_ok: durationOk,
        character_consistency: true,
        one_joke_only: true,
        has_punchline: hasPunchline,
        dialogue_short_enough: dialogueShortEnough,
        visual_generation_risk: visualRisk,
        brand_safety: true,
        world_rules_ok: true
      },
      scores: {
        comedy,
        character_fit: characterFit,
        visual_feasibility: visualFeasibility,
        series_consistency: seriesConsistency
      },
      problems: passes ? [] : ["该脚本需要压缩台词或强化结尾反转。"],
      revision_notes:
        visualRisk === "medium"
          ? ["锅形捏捏属于新增道具，后续分镜应简化成便签或压痕。"]
          : ["动作简单，适合进入后续分镜。"],
      recommended_next_action: passes ? "use_as_script" : "revise_script"
    };
  });

  return { reviews };
}

function scoreComedy(theme: string, title: string) {
  if (theme === "新人入职") {
    return 92;
  }

  if (theme === "绩效" || theme === "被主人偏爱") {
    return 89;
  }

  if (theme === "开会" || title.includes("紧急")) {
    return 86;
  }

  if (theme === "背锅") {
    return 78;
  }

  return 84;
}

function createMockScriptBatch(payload: unknown) {
  const request = readNestedRecord(payload, ["generationRequest"]);
  const count = readNumber(request, "count") ?? 1;
  const requestedTheme = readString(request, "theme") ?? "新人入职";
  const themePool = [
    requestedTheme,
    "开会",
    "绩效",
    "加班",
    "背锅",
    "汇报",
    "领导画饼",
    "团建",
    "办公室座位",
    "被主人偏爱"
  ];

  const scripts = Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const theme = themePool[index % themePool.length];
    const scriptId = `idea_${String(number).padStart(3, "0")}`;
    const title = createTitle(theme, number);

    return {
      script_id: scriptId,
      title,
      duration_target_seconds: 12,
      workplace_theme: theme,
      characters: ["manager_cat", "new_bear"],
      logline: createLogline(theme),
      beats: createBeats(theme),
      punchline: createPunchline(theme),
      generation_notes: "Mock 编剧 Agent 输出：动作简单，适合后续分镜和 AI 视频生成。"
    };
  });

  return { scripts };
}

function createTitle(theme: string, number: number) {
  const titleByTheme: Record<string, string> = {
    新人入职: "抗压测试",
    开会: "紧急会议",
    绩效: "弹回率考核",
    加班: "自愿留桌",
    背锅: "谁压扁的",
    汇报: "向主人汇报",
    领导画饼: "下周给你升格",
    团建: "集体被捏",
    办公室座位: "黄金工位",
    被主人偏爱: "今日重点培养"
  };

  return `${titleByTheme[theme] ?? "桌面小事"} ${number}`;
}

function createLogline(theme: string) {
  const loglineByTheme: Record<string, string> = {
    新人入职: "新人以为入职要考试，结果发现抗压测试是真的被压。",
    开会: "奶盖宣布紧急会议，会议内容是讨论为什么天天开会。",
    绩效: "奶盖用弹回速度评价绩效，团子发现主管自己弹得最慢。",
    加班: "奶盖说大家自愿留下，团子发现门口是主人的手。",
    背锅: "桌上出现压痕，奶盖让新人背锅，结果锅也是捏捏。",
    汇报: "奶盖教团子向主人汇报，最后发现主人只想捏一下。",
    领导画饼: "奶盖给新人画饼，主人真的拿来一个饼干垫在下面。",
    团建: "奶盖组织团建，项目是一起被主人按扁。",
    办公室座位: "团子抢到最佳工位，才知道那里最容易被主人看到。",
    被主人偏爱: "奶盖以为被频繁拿起是受宠，团子发现那叫高频使用。"
  };

  return loglineByTheme[theme] ?? "两个捏捏在桌面办公室里遇到荒诞职场规则。";
}

function createBeats(theme: string) {
  const scriptsByTheme: Record<string, Array<{ time_range: string; action: string; dialogue: string }>> = {
    新人入职: [
      {
        time_range: "0-3s",
        action: "团子被主人放到桌面上，左右看了一圈。",
        dialogue: "团子：这里上班吗？"
      },
      {
        time_range: "3-7s",
        action: "奶盖滑到团子面前，表情严肃。",
        dialogue: "奶盖：先做抗压。"
      },
      {
        time_range: "7-11s",
        action: "主人手指轻轻把奶盖压扁。",
        dialogue: "团子：怎么做？"
      },
      {
        time_range: "11-13s",
        action: "奶盖慢慢弹回，眼神空白。",
        dialogue: "奶盖：刚做完。"
      }
    ],
    开会: [
      {
        time_range: "0-3s",
        action: "奶盖站在便签纸前，像在主持会议。",
        dialogue: "奶盖：紧急开会。"
      },
      {
        time_range: "3-6s",
        action: "团子认真凑近。",
        dialogue: "团子：讨论什么？"
      },
      {
        time_range: "6-10s",
        action: "奶盖看着空白便签沉默一秒。",
        dialogue: "奶盖：讨论开会。"
      },
      {
        time_range: "10-13s",
        action: "主人手影落下，两个捏捏同时定住。",
        dialogue: "团子：这叫落地吗？"
      }
    ],
    绩效: [
      {
        time_range: "0-3s",
        action: "奶盖拿便签挡在身前，像绩效表。",
        dialogue: "奶盖：考核弹回率。"
      },
      {
        time_range: "3-6s",
        action: "团子被轻轻按扁后立刻弹回。",
        dialogue: "团子：这样吗？"
      },
      {
        time_range: "6-10s",
        action: "奶盖被按扁，迟迟没有弹回。",
        dialogue: "奶盖：我在蓄力。"
      },
      {
        time_range: "10-13s",
        action: "团子看着奶盖，眨了眨眼。",
        dialogue: "团子：这是待改进？"
      }
    ],
    加班: [
      {
        time_range: "0-3s",
        action: "桌灯亮起，两个捏捏还在桌面。",
        dialogue: "奶盖：自愿留下。"
      },
      {
        time_range: "3-6s",
        action: "团子看向桌边。",
        dialogue: "团子：能走吗？"
      },
      {
        time_range: "6-10s",
        action: "主人手掌挡住离开的方向。",
        dialogue: "奶盖：很自愿。"
      },
      {
        time_range: "10-13s",
        action: "团子默默坐回便签纸旁。",
        dialogue: "团子：懂了。"
      }
    ],
    背锅: [
      {
        time_range: "0-3s",
        action: "桌面上有一个圆圆压痕。",
        dialogue: "奶盖：谁弄的？"
      },
      {
        time_range: "3-6s",
        action: "团子小心看向奶盖。",
        dialogue: "团子：像你脸。"
      },
      {
        time_range: "6-10s",
        action: "奶盖把一个小锅形捏捏推过来。",
        dialogue: "奶盖：锅来了。"
      },
      {
        time_range: "10-13s",
        action: "小锅捏捏被压扁，两个角色沉默。",
        dialogue: "团子：它也背不动。"
      }
    ]
  };

  return scriptsByTheme[theme] ?? scriptsByTheme["新人入职"];
}

function createPunchline(theme: string) {
  const punchlineByTheme: Record<string, string> = {
    新人入职: "抗压是字面意义上的抗压。",
    开会: "会议的落地，是主人的手影真的落下来。",
    绩效: "弹回率成了捏捏公司的核心 KPI。",
    加班: "自愿留下，是因为出口被主人挡住了。",
    背锅: "背锅在这里也是一个会被捏扁的岗位。",
    汇报: "汇报对象听不懂，但很会捏。",
    领导画饼: "画饼最后变成了真的桌面垫片。",
    团建: "团队建设的项目是一起变扁。",
    办公室座位: "黄金工位的意思是最容易被主人拿起。",
    被主人偏爱: "被偏爱和被高频使用只有一只手的距离。"
  };

  return punchlineByTheme[theme] ?? "职场规则在捏捏世界里变成了字面意思。";
}

function summarizePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { type: typeof payload };
  }

  const value = payload as Record<string, unknown>;

  return {
    keys: Object.keys(value),
    world_name: readNestedString(value, ["world", "series_name"]),
    character_count: readNestedArrayLength(value, ["characters", "characters"]),
    visual_format: readNestedString(value, ["visualStyle", "format"])
  };
}

function readNestedRecord(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return current && typeof current === "object" && !Array.isArray(current)
    ? (current as Record<string, unknown>)
    : null;
}

function readNumber(value: Record<string, unknown> | null, key: string) {
  const field = value?.[key];
  return typeof field === "number" ? field : null;
}

function readString(value: Record<string, unknown> | null, key: string) {
  const field = value?.[key];
  return typeof field === "string" ? field : null;
}

function readNestedArray(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return [];
    }

    current = (current as Record<string, unknown>)[key];
  }

  return Array.isArray(current) ? current : [];
}

function readNestedString(value: Record<string, unknown>, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "string" ? current : null;
}

function readNestedArrayLength(value: Record<string, unknown>, path: string[]) {
  let current: unknown = value;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return Array.isArray(current) ? current.length : null;
}

export class VolcengineClient implements LLMClient {
  private openai: OpenAI;
  private endpoint: string;

  constructor(apiKey: string, endpoint: string) {
    if (!apiKey || !endpoint) {
      throw new Error("Missing ARK_API_KEY or ARK_MODEL_ENDPOINT for VolcengineClient.");
    }
    this.openai = new OpenAI({
      apiKey,
      baseURL: "https://ark.cn-beijing.volces.com/api/v3",
      timeout: 180000 // 3 minutes timeout
    });
    this.endpoint = endpoint;
  }

  async generateJson<T>(params: GenerateJsonParams): Promise<T> {
    const promptWithJsonInstruction = `${params.systemPrompt}\n\n[IMPORTANT] You MUST output ONLY valid JSON. Your output will be parsed programmatically. Please make sure to strictly follow the expected schema structure for ${params.schemaName}. DO NOT wrap the output in markdown codeblocks like \`\`\`json. Just output the raw JSON object.`;

    const response = await this.openai.chat.completions.create({
      model: this.endpoint,
      messages: [
        { role: "system", content: promptWithJsonInstruction },
        { role: "user", content: JSON.stringify(params.userPayload) }
      ],
      temperature: params.temperature ?? 0.7,
      // response_format: { type: "json_object" } // Safe fallback relying on prompts and cleaning logic
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("LLM response content is empty.");
    }

    return this.cleanAndParseJson<T>(content);
  }

  private cleanAndParseJson<T>(content: string): T {
    let cleanContent = content.trim();
    if (cleanContent.startsWith("\`\`\`json")) {
      cleanContent = cleanContent.slice(7);
    } else if (cleanContent.startsWith("\`\`\`")) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith("\`\`\`")) {
      cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();
    
    const firstBrace = cleanContent.indexOf("{");
    const lastBrace = cleanContent.lastIndexOf("}");
    const firstBracket = cleanContent.indexOf("[");
    const lastBracket = cleanContent.lastIndexOf("]");
    
    const startIdx = Math.min(
        firstBrace !== -1 ? firstBrace : Infinity,
        firstBracket !== -1 ? firstBracket : Infinity
    );
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== Infinity && endIdx !== -1 && endIdx > startIdx) {
        cleanContent = cleanContent.substring(startIdx, endIdx + 1);
    }

    try {
      return JSON.parse(cleanContent) as T;
    } catch (e) {
      // 针对大模型偶尔多输出一个结尾大括号的容错处理
      try {
        if (cleanContent.endsWith("}")) {
           const temp = cleanContent.slice(0, -1).trim();
           return JSON.parse(temp) as T;
        }
      } catch (e2) {
        // ignore
      }
      throw new Error(`Failed to parse LLM JSON output. Content was:\n${content}`);
    }
  }
}

export class GeminiClient implements LLMClient {
  private openai: OpenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string) {
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY for GeminiClient.");
    }
    this.openai = new OpenAI({
      apiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      timeout: 180000 // 3 minutes timeout
    });
    this.modelName = modelName || "gemini-2.5-flash";
  }

  async generateJson<T>(params: GenerateJsonParams): Promise<T> {
    const promptWithJsonInstruction = `${params.systemPrompt}\n\n[IMPORTANT] You MUST output ONLY valid JSON. Your output will be parsed programmatically. Please make sure to strictly follow the expected schema structure for ${params.schemaName}. DO NOT wrap the output in markdown codeblocks like \`\`\`json. Just output the raw JSON object.`;

    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: [
        { role: "system", content: promptWithJsonInstruction },
        { role: "user", content: JSON.stringify(params.userPayload) }
      ],
      temperature: params.temperature ?? 0.7,
      // response_format: { type: "json_object" } // Depending on compatibility support, fallback to prompt
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("LLM response content is empty.");
    }

    return this.cleanAndParseJson<T>(content);
  }

  private cleanAndParseJson<T>(content: string): T {
    let cleanContent = content.trim();
    if (cleanContent.startsWith("\`\`\`json")) {
      cleanContent = cleanContent.slice(7);
    } else if (cleanContent.startsWith("\`\`\`")) {
      cleanContent = cleanContent.slice(3);
    }
    if (cleanContent.endsWith("\`\`\`")) {
      cleanContent = cleanContent.slice(0, -3);
    }
    cleanContent = cleanContent.trim();
    
    const firstBrace = cleanContent.indexOf("{");
    const lastBrace = cleanContent.lastIndexOf("}");
    const firstBracket = cleanContent.indexOf("[");
    const lastBracket = cleanContent.lastIndexOf("]");
    
    const startIdx = Math.min(
        firstBrace !== -1 ? firstBrace : Infinity,
        firstBracket !== -1 ? firstBracket : Infinity
    );
    const endIdx = Math.max(lastBrace, lastBracket);

    if (startIdx !== Infinity && endIdx !== -1 && endIdx > startIdx) {
        cleanContent = cleanContent.substring(startIdx, endIdx + 1);
    }

    try {
      return JSON.parse(cleanContent) as T;
    } catch (e) {
      // 针对大模型偶尔多输出一个结尾大括号的容错处理
      try {
        if (cleanContent.endsWith("}")) {
           const temp = cleanContent.slice(0, -1).trim();
           return JSON.parse(temp) as T;
        }
      } catch (e2) {
        // ignore
      }
      throw new Error(`Failed to parse LLM JSON output. Content was:\n${content}`);
    }
  }
}

