import { describe, expect, it } from "vitest";
import { DEFAULT_SCRIPT, DEFAULT_SETTINGS, parseSavedSettings } from "../app/lib/savedSettings";

describe("parseSavedSettings", () => {
  it("returns the defaults when nothing is saved", () => {
    expect(parseSavedSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns the defaults for unreadable JSON", () => {
    expect(parseSavedSettings("{not json")).toEqual(DEFAULT_SETTINGS);
  });

  it.each(["null", "42", '"text"', "[]"])("returns the defaults for non-object JSON %s", raw => {
    expect(parseSavedSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps an empty script, which is a valid value", () => {
    expect(parseSavedSettings('{"script":""}').script).toBe("");
  });

  it("falls back to the default script when the script is not a string", () => {
    expect(parseSavedSettings('{"script":123}').script).toBe(DEFAULT_SCRIPT);
    expect(parseSavedSettings('{"script":null}').script).toBe(DEFAULT_SCRIPT);
  });

  it("falls back to defaults for font size and colour values it does not know", () => {
    expect(parseSavedSettings('{"fontSize":"text-huge","themeColor":"purple"}')).toEqual(DEFAULT_SETTINGS);
    expect(parseSavedSettings('{"fontSize":4,"themeColor":true}')).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps valid font size and colour values", () => {
    expect(parseSavedSettings('{"script":"x","fontSize":"text-6xl","themeColor":"blue"}')).toEqual({
      script: "x",
      fontSize: "text-6xl",
      themeColor: "blue",
    });
  });
});
