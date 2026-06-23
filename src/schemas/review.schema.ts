export type ReviewDecision = "pass" | "revise" | "reject";
export type GenerationRisk = "low" | "medium" | "high";

export interface ScriptReview {
  script_id: string;
  overall_score: number;
  decision: ReviewDecision;
  checks: {
    duration_ok: boolean;
    character_consistency: boolean;
    one_joke_only: boolean;
    has_punchline: boolean;
    dialogue_short_enough: boolean;
    visual_generation_risk: GenerationRisk;
    brand_safety: boolean;
    world_rules_ok: boolean;
  };
  scores: {
    comedy: number;
    character_fit: number;
    visual_feasibility: number;
    series_consistency: number;
  };
  problems: string[];
  revision_notes: string[];
  recommended_next_action: "use_as_script" | "revise_script" | "reject_script";
}

export interface ScriptReviewBatch {
  reviews: ScriptReview[];
}

export function validateScriptReviewBatch(
  value: unknown,
  options: {
    expectedScriptIds: string[];
  }
): ScriptReviewBatch {
  if (!isRecord(value) || !Array.isArray(value.reviews)) {
    throw new Error("ScriptReviewBatch must contain a reviews array.");
  }

  const expectedIds = new Set(options.expectedScriptIds);
  const reviews = value.reviews.map((review, index) => validateScriptReview(review, index));

  for (const review of reviews) {
    if (!expectedIds.has(review.script_id)) {
      throw new Error(`Review references unknown script id: ${review.script_id}.`);
    }
  }

  for (const scriptId of expectedIds) {
    if (!reviews.some((review) => review.script_id === scriptId)) {
      throw new Error(`Missing review for script id: ${scriptId}.`);
    }
  }

  return { reviews };
}

export function validateScriptReview(value: unknown, index?: number): ScriptReview {
  const prefix = index === undefined ? "ScriptReview" : `ScriptReview at index ${index}`;

  if (!isRecord(value)) {
    throw new Error(`${prefix} must be an object.`);
  }

  const review = {
    script_id: requireString(value, "script_id", prefix),
    overall_score: requireScore(value, "overall_score", prefix),
    decision: requireDecision(value, "decision", prefix),
    checks: requireChecks(value.checks, prefix),
    scores: requireScores(value.scores, prefix),
    problems: requireStringArray(value, "problems", prefix),
    revision_notes: requireStringArray(value, "revision_notes", prefix),
    recommended_next_action: requireNextAction(value, "recommended_next_action", prefix)
  };

  return review;
}

function requireChecks(value: unknown, prefix: string): ScriptReview["checks"] {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.checks must be an object.`);
  }

  const risk = requireString(value, "visual_generation_risk", `${prefix}.checks`);

  if (!["low", "medium", "high"].includes(risk)) {
    throw new Error(`${prefix}.checks.visual_generation_risk is invalid.`);
  }

  return {
    duration_ok: requireBoolean(value, "duration_ok", `${prefix}.checks`),
    character_consistency: requireBoolean(value, "character_consistency", `${prefix}.checks`),
    one_joke_only: requireBoolean(value, "one_joke_only", `${prefix}.checks`),
    has_punchline: requireBoolean(value, "has_punchline", `${prefix}.checks`),
    dialogue_short_enough: requireBoolean(value, "dialogue_short_enough", `${prefix}.checks`),
    visual_generation_risk: risk as GenerationRisk,
    brand_safety: requireBoolean(value, "brand_safety", `${prefix}.checks`),
    world_rules_ok: requireBoolean(value, "world_rules_ok", `${prefix}.checks`)
  };
}

function requireScores(value: unknown, prefix: string): ScriptReview["scores"] {
  if (!isRecord(value)) {
    throw new Error(`${prefix}.scores must be an object.`);
  }

  return {
    comedy: requireScore(value, "comedy", `${prefix}.scores`),
    character_fit: requireScore(value, "character_fit", `${prefix}.scores`),
    visual_feasibility: requireScore(value, "visual_feasibility", `${prefix}.scores`),
    series_consistency: requireScore(value, "series_consistency", `${prefix}.scores`)
  };
}

function requireDecision(value: Record<string, unknown>, key: string, prefix: string): ReviewDecision {
  const field = requireString(value, key, prefix);

  if (!["pass", "revise", "reject"].includes(field)) {
    throw new Error(`${prefix}.${key} is invalid.`);
  }

  return field as ReviewDecision;
}

function requireNextAction(
  value: Record<string, unknown>,
  key: string,
  prefix: string
): ScriptReview["recommended_next_action"] {
  const field = requireString(value, key, prefix);

  if (!["use_as_script", "revise_script", "reject_script"].includes(field)) {
    throw new Error(`${prefix}.${key} is invalid.`);
  }

  return field as ScriptReview["recommended_next_action"];
}

function requireBoolean(value: Record<string, unknown>, key: string, prefix: string): boolean {
  const field = value[key];

  if (typeof field !== "boolean") {
    throw new Error(`${prefix}.${key} must be a boolean.`);
  }

  return field;
}

function requireScore(value: Record<string, unknown>, key: string, prefix: string): number {
  const field = value[key];

  if (typeof field !== "number" || Number.isNaN(field) || field < 0 || field > 100) {
    throw new Error(`${prefix}.${key} must be a number from 0 to 100.`);
  }

  return field;
}

function requireString(value: Record<string, unknown>, key: string, prefix: string): string {
  const field = value[key];

  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`${prefix}.${key} must be a non-empty string.`);
  }

  return field;
}

function requireStringArray(value: Record<string, unknown>, key: string, prefix: string): string[] {
  const field = value[key];

  if (!Array.isArray(field) || field.some((item) => typeof item !== "string")) {
    throw new Error(`${prefix}.${key} must be a string array.`);
  }

  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
