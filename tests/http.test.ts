import { describe, expect, it } from "vitest";
import { z } from "zod";
import { body, sameOrigin } from "@/lib/http";
import { MAX_BYTES, safeFilename } from "@/lib/shared";

describe("request boundaries", () => {
  it("rejects missing and cross-site origins on mutations", () => {
    for (const origin of [undefined, "https://evil.example", "null"]) {
      const request = new Request("https://share.example/api/auth", {
        method: "POST",
        headers: origin ? { origin } : {},
      });
      expect(() => sameOrigin(request)).toThrow("请求来源");
    }
    expect(() =>
      sameOrigin(
        new Request("https://share.example/api/auth", {
          headers: { origin: "https://share.example" },
        }),
      ),
    ).not.toThrow();
  });
  it("bounds streamed metadata even without a Content-Length header", async () => {
    const request = new Request("https://share.example", {
      method: "POST",
      body: JSON.stringify({ value: "x".repeat(17000) }),
    });
    await expect(
      body(request, z.object({ value: z.string() })),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("rejects malformed JSON with a client error", async () => {
    await expect(
      body(
        new Request("https://share.example", { method: "POST", body: "{" }),
        z.object({}),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("measures Chinese text and emoji in bytes, not string length", () => {
    expect(new Blob(["中文🙂"]).size).toBe(10);
    const text = "中".repeat(Math.floor(MAX_BYTES / 3) + 1);
    expect(text.length).toBeLessThan(MAX_BYTES);
    expect(new Blob([text]).size).toBeGreaterThan(MAX_BYTES);
  });
  it("keeps filenames from carrying path separators or header control characters", () => {
    expect(safeFilename("../a\\b\r\n.txt")).toBe(".._a_b__.txt");
    expect(safeFilename(" ")).toBe("download");
  });
});
