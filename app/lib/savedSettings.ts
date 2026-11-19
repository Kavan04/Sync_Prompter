export const STORAGE_KEY = "syncprompter-state";
export const DEFAULT_SCRIPT = "Your script goes here. We’ll handle the flow.";

export const FONT_SIZES = ["text-xl", "text-2xl", "text-4xl", "text-6xl"] as const;
export type FontSize = (typeof FONT_SIZES)[number];

export const COLOR_THEMES = ["green", "yellow", "blue", "white"] as const;
export type ColorTheme = (typeof COLOR_THEMES)[number];

export interface SavedSettings {
  script: string;
  fontSize: FontSize;
  themeColor: ColorTheme;
}

export const DEFAULT_SETTINGS: SavedSettings = {
  script: DEFAULT_SCRIPT,
  fontSize: "text-2xl",
  themeColor: "green",
};

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

// Reads the saved state and keeps only values of the expected type. Anything
// else falls back to the default for that field. An empty script is valid.
export function parseSavedSettings(raw: string | null): SavedSettings {
  if (raw === null) return DEFAULT_SETTINGS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return DEFAULT_SETTINGS;

  const record = parsed as Record<string, unknown>;
  return {
    script: typeof record.script === "string" ? record.script : DEFAULT_SETTINGS.script,
    fontSize: isOneOf(FONT_SIZES, record.fontSize) ? record.fontSize : DEFAULT_SETTINGS.fontSize,
    themeColor: isOneOf(COLOR_THEMES, record.themeColor) ? record.themeColor : DEFAULT_SETTINGS.themeColor,
  };
}
