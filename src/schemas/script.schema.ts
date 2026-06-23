export interface ScriptBeat {
  time_range: string;
  action: string;
  dialogue: string;
}

export interface Script {
  script_id: string;
  title: string;
  duration_target_seconds: number;
  workplace_theme: string;
  characters: string[];
  logline: string;
  beats: ScriptBeat[];
  punchline: string;
  generation_notes?: string;
}

export interface ScriptBatch {
  scripts: Script[];
}

export interface CharacterCollection {
  characters: Array<{
    id: string;
    name?: string;
  }>;
}

export interface ContentRules {
  script_rules?: {
    min_duration_seconds?: number;
    max_duration_seconds?: number;
    max_characters_per_episode?: number;
    max_beats?: number;
    max_dialogue_chars_per_line?: number;
    must_have_punchline?: boolean;
    must_have_workplace_theme?: boolean;
  };
}

export function validateScriptBatch(
  value: unknown,
  options: {
    expectedCount?: number;
    characters: CharacterCollection;
    contentRules: ContentRules;
  }
): ScriptBatch {
  if (!isRecord(value) || !Array.isArray(value.scripts)) {
    throw new Error("ScriptBatch must contain a scripts array.");
  }

  if (options.expectedCount !== undefined && value.scripts.length !== options.expectedCount) {
    throw new Error(`Expected ${options.expectedCount} scripts, received ${value.scripts.length}.`);
  }

  const scripts = value.scripts.map((script, index) =>
    validateScript(script, {
      index,
      characters: options.characters,
      contentRules: options.contentRules
    })
  );

  return { scripts };
}

export function validateScript(
  value: unknown,
  options: {
    index?: number;
    characters: CharacterCollection;
    contentRules: ContentRules;
  }
): Script {
  const prefix = options.index === undefined ? "Script" : `Script at index ${options.index}`;

  if (!isRecord(value)) {
    throw new Error(`${prefix} must be an object.`);
  }

  const script = {
    script_id: requireString(value, "script_id", prefix),
    title: requireString(value, "title", prefix),
    duration_target_seconds: requireNumber(value, "duration_target_seconds", prefix),
    workplace_theme: requireString(value, "workplace_theme", prefix),
    characters: requireStringArray(value, "characters", prefix),
    logline: requireString(value, "logline", prefix),
    beats: requireBeatArray(value, prefix),
    punchline: requireString(value, "punchline", prefix),
    generation_notes: typeof value.generation_notes === "string" ? value.generation_notes : undefined
  };

  validateBusinessRules(script, options.characters, options.contentRules, prefix);

  return script;
}

function validateBusinessRules(
  script: Script,
  characters: CharacterCollection,
  contentRules: ContentRules,
  prefix: string
) {
  const rules = contentRules.script_rules ?? {};
  const knownCharacterIds = new Set(characters.characters.map((character) => character.id));
  const minDuration = rules.min_duration_seconds ?? 10;
  const maxDuration = rules.max_duration_seconds ?? 15;
  const maxCharacters = rules.max_characters_per_episode ?? 3;
  const maxBeats = rules.max_beats ?? 5;
  const maxDialogueChars = rules.max_dialogue_chars_per_line ?? 18;

  if (script.duration_target_seconds < minDuration || script.duration_target_seconds > maxDuration) {
    throw new Error(`${prefix} duration must be between ${minDuration} and ${maxDuration} seconds.`);
  }

  if (script.characters.length < 1 || script.characters.length > maxCharacters) {
    throw new Error(`${prefix} must use 1-${maxCharacters} characters.`);
  }

  for (const characterId of script.characters) {
    if (!knownCharacterIds.has(characterId)) {
      throw new Error(`${prefix} uses unknown character id: ${characterId}.`);
    }
  }

  if (script.beats.length < 2 || script.beats.length > maxBeats) {
    throw new Error(`${prefix} must contain 2-${maxBeats} beats.`);
  }

  for (const beat of script.beats) {
    if (countDisplayChars(beat.dialogue) > maxDialogueChars) {
      throw new Error(`${prefix} dialogue is too long: ${beat.dialogue}`);
    }
  }

  if (rules.must_have_punchline !== false && script.punchline.trim().length === 0) {
    throw new Error(`${prefix} must have a punchline.`);
  }

  if (rules.must_have_workplace_theme !== false && script.workplace_theme.trim().length === 0) {
    throw new Error(`${prefix} must have a workplace theme.`);
  }
}

function requireBeatArray(value: Record<string, unknown>, prefix: string): ScriptBeat[] {
  if (!Array.isArray(value.beats)) {
    throw new Error(`${prefix}.beats must be an array.`);
  }

  return value.beats.map((beat, index) => {
    if (!isRecord(beat)) {
      throw new Error(`${prefix}.beats[${index}] must be an object.`);
    }

    return {
      time_range: requireString(beat, "time_range", `${prefix}.beats[${index}]`),
      action: requireString(beat, "action", `${prefix}.beats[${index}]`),
      dialogue: requireString(beat, "dialogue", `${prefix}.beats[${index}]`)
    };
  });
}

function requireString(value: Record<string, unknown>, key: string, prefix: string): string {
  const field = value[key];

  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`${prefix}.${key} must be a non-empty string.`);
  }

  return field;
}

function requireNumber(value: Record<string, unknown>, key: string, prefix: string): number {
  const field = value[key];

  if (typeof field !== "number" || Number.isNaN(field)) {
    throw new Error(`${prefix}.${key} must be a number.`);
  }

  return field;
}

function requireStringArray(value: Record<string, unknown>, key: string, prefix: string): string[] {
  const field = value[key];

  if (!Array.isArray(field) || field.length === 0 || field.some((item) => typeof item !== "string")) {
    throw new Error(`${prefix}.${key} must be a non-empty string array.`);
  }

  return field;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function countDisplayChars(value: string) {
  return Array.from(value.replace(/\s/g, "")).length;
}
