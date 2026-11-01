import { describe, expect, it } from "vitest";
import { GRAPH_SCOPES } from "./msal";
import { redirectUriFor } from "./config";

describe("Microsoft app registration", () => {
  it("uses the registered redirect URIs, including the trailing slash", () => {
    expect(redirectUriFor("http://localhost:5173", "/")).toBe("http://localhost:5173/");
    expect(redirectUriFor("https://cra1gmanning.github.io", "/WOP/")).toBe("https://cra1gmanning.github.io/WOP/");
  });

  it("requests only the delegated Graph scopes registered on the app", () => {
    expect(GRAPH_SCOPES).toEqual(["User.Read", "Files.ReadWrite", "offline_access"]);
  });
});
