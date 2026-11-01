import { describe, expect, it } from "vitest";
import { chaptersFile, DEFAULT_LIBRARY_ROOT, driveContentUrl, encodeDrivePath, libraryFile, normalizeLibraryRoot } from "./paths";

describe("drive paths", () => {
  it("defaults the library folder and trims slashes", () => {
    expect(DEFAULT_LIBRARY_ROOT).toBe("Workouts");
    expect(normalizeLibraryRoot(" /Workouts/ ")).toBe("Workouts");
    expect(normalizeLibraryRoot("")).toBe("Workouts");
    expect(libraryFile("Workouts")).toBe("Workouts/_app/library.json");
    expect(chaptersFile("Workouts")).toBe("Workouts/_app/chapters.json");
    expect(chaptersFile("/Custom/")).toBe("Custom/_app/chapters.json");
  });

  it("encodes spaces and hashes per segment", () => {
    expect(encodeDrivePath("/Workouts/_app/library.json")).toBe("Workouts/_app/library.json");
    expect(encodeDrivePath("Classes/02 Moderate/HIIT #1.mp4")).toBe("Classes/02%20Moderate/HIIT%20%231.mp4");
  });

  it("builds a Graph content URL from the default folder", () => {
    expect(driveContentUrl("Workouts/_app/state.json")).toBe(
      "https://graph.microsoft.com/v1.0/me/drive/root:/Workouts/_app/state.json:/content",
    );
  });
});
