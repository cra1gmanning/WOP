// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { sanitizeLessonHtml } from "./sanitize";

describe("sanitizeLessonHtml", () => {
  it("keeps lesson formatting and opens links in a new tab", () => {
    const clean = sanitizeLessonHtml(
      `<h2>Warm-up</h2><p>Keep <strong>this</strong> and <em>that</em>.</p><ul><li>One</li></ul><a href="https://example.com/guide">Guide</a>`,
    );
    expect(clean).toContain("<h2>Warm-up</h2>");
    expect(clean).toContain("<strong>this</strong>");
    expect(clean).toContain("<em>that</em>");
    expect(clean).toContain("<li>One</li>");
    expect(clean).toContain('href="https://example.com/guide"');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("strips scripts, embedded frames, handlers, and javascript urls", () => {
    const clean = sanitizeLessonHtml(
      [
        `<p onclick="alert(1)">Hi</p>`,
        `<script>alert(1)</script>`,
        `<iframe src="https://example.com/embed"></iframe>`,
        `<object data="https://example.com/file"></object>`,
        `<form action="https://example.com"><input></form>`,
        `<style>body{background:url(javascript:alert(1))}</style>`,
        `<a href="javascript:alert(1)">click</a>`,
        `<img src="javascript:alert(1)" onerror="alert(1)">`,
        `<video src="drills/session-a/flow.mp4"></video>`,
      ].join(""),
    );
    expect(clean.toLowerCase()).not.toContain("<script");
    expect(clean.toLowerCase()).not.toContain("<iframe");
    expect(clean.toLowerCase()).not.toContain("<object");
    expect(clean.toLowerCase()).not.toContain("<form");
    expect(clean.toLowerCase()).not.toContain("<style");
    expect(clean.toLowerCase()).not.toContain("<video");
    expect(clean.toLowerCase()).not.toContain("onclick");
    expect(clean.toLowerCase()).not.toContain("onerror");
    expect(clean.toLowerCase()).not.toContain("javascript:");
    expect(clean).toContain("Hi");
    expect(clean).toContain("click");
  });
});
