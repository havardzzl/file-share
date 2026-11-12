import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Share } from "@/lib/shared";
const state = vi.hoisted(() => ({
  row: null as Share | null,
  authenticated: true,
  size: 10,
  content: new Uint8Array([104, 101, 108, 108, 111, 119, 111, 114, 108, 100]),
  missing: false,
  signed: vi.fn(),
  removed: vi.fn(),
  inserted: vi.fn(),
  updated: vi.fn(),
  deleted: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireOwner: async () => {
    if (!state.authenticated) {
      const { HttpError } = await import("@/lib/http");
      throw new HttpError(401, "未登录");
    }
  },
}));
vi.mock("@/lib/supabase", () => ({
  admin: () => ({
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        lte: () => query,
        maybeSingle: async () => ({ data: state.row, error: null }),
        insert: async (row: Share) => {
          state.inserted(row);
          state.row = row;
          return { error: null };
        },
        update: (patch: Partial<Share>) => {
          state.updated(patch);
          if (state.row) Object.assign(state.row, patch);
          return query;
        },
        delete: () => {
          state.deleted();
          return query;
        },
        then: (resolve: (v: { error: null }) => unknown) =>
          Promise.resolve(resolve({ error: null })),
      };
      return query;
    },
    storage: {
      from: () => ({
        info: async () =>
          state.missing
            ? { data: null, error: new Error("missing") }
            : { data: { size: state.size }, error: null },
        download: async () => ({
          data: new Blob([state.content as BlobPart]),
          error: null,
        }),
        createSignedUploadUrl: async () => ({
          data: { signedUrl: "https://storage.example/upload?token=secret" },
          error: null,
        }),
        createSignedUrl: async (...args: unknown[]) => {
          state.signed(...args);
          return {
            data: {
              signedUrl: "https://storage.example/download?token=secret",
            },
            error: null,
          };
        },
        remove: async (...args: unknown[]) => {
          state.removed(...args);
          return { error: null };
        },
      }),
    },
  }),
}));
import { POST as prepare } from "@/app/api/shares/prepare/route";
import { POST as complete } from "@/app/api/shares/[id]/complete/route";
import { GET as download } from "@/app/api/shares/[id]/download/route";
import { DELETE as remove } from "@/app/api/shares/[id]/route";
import { GET as cleanup } from "@/app/api/cleanup/route";
import { getShare } from "@/lib/shares";
import { MAX_BYTES } from "@/lib/shared";
const id = "018f9244-0cef-432a-9ab0-0d080910b0c7";
const context = { params: Promise.resolve({ id }) };
function request(path = "prepare", data?: unknown) {
  return new Request(`https://share.example/api/shares/${path}`, {
    method: "POST",
    headers: { origin: "https://share.example" },
    body: data ? JSON.stringify(data) : undefined,
  });
}
function fixture(): Share {
  return {
    id,
    storage_path: `${id}/object`,
    filename: "hello.txt",
    kind: "file",
    size_bytes: 10,
    status: "pending",
    created_at: new Date().toISOString(),
    expires_at: null,
  };
}
beforeEach(() => {
  state.row = fixture();
  state.authenticated = true;
  state.size = 10;
  state.missing = false;
  state.content = new TextEncoder().encode("helloworld");
});
describe("share lifecycle", () => {
  it("blocks upload authorization for unauthenticated visitors", async () => {
    state.authenticated = false;
    expect(
      (
        await prepare(
          request("prepare", {
            filename: "a.txt",
            kind: "file",
            size: 10,
            expiresIn: 7,
          }),
        )
      ).status,
    ).toBe(401);
    expect(state.inserted).not.toHaveBeenCalled();
  });
  it("rejects zero byte, oversized, and fractional size claims", async () => {
    for (const size of [0, -1, 1.5, MAX_BYTES + 1])
      expect(
        (
          await prepare(
            request("prepare", {
              filename: "a",
              kind: "file",
              size,
              expiresIn: 7,
            }),
          )
        ).status,
      ).toBe(400);
    expect(state.inserted).not.toHaveBeenCalled();
  });
  it("accepts exactly 5MiB, generates opaque paths, and creates a pending record", async () => {
    const response = await prepare(
      request("prepare", {
        filename: "文档.pdf",
        kind: "file",
        size: MAX_BYTES,
        expiresIn: 7,
      }),
    );
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(state.row).toMatchObject({
      status: "pending",
      size_bytes: MAX_BYTES,
      filename: "文档.pdf",
    });
    expect(state.row?.storage_path).not.toContain("文档.pdf");
    expect(Date.parse(state.row!.expires_at!)).toBeGreaterThan(
      Date.now() + 6 * 86400000,
    );
  });
  it("never exposes pending, deleted, expired, or missing shares", async () => {
    for (const row of [
      fixture(),
      { ...fixture(), status: "deleted" as const },
      {
        ...fixture(),
        status: "ready" as const,
        expires_at: new Date(Date.now() - 1000).toISOString(),
      },
      null,
    ]) {
      state.row = row;
      await expect(getShare(id)).rejects.toMatchObject({ status: 404 });
      expect(
        (await download(new Request("https://share.example"), context)).status,
      ).toBe(404);
    }
    expect(state.signed).not.toHaveBeenCalled();
  });
  it("rejects malformed share IDs before querying storage", async () => {
    await expect(getShare("not-an-id")).rejects.toMatchObject({ status: 404 });
  });
  it("refuses finalization until the object exists", async () => {
    state.missing = true;
    expect((await complete(request(id), context)).status).toBe(409);
    expect(state.updated).not.toHaveBeenCalled();
  });
  it("validates actual storage size and retires a mismatched upload", async () => {
    state.size = MAX_BYTES + 1;
    expect((await complete(request(id), context)).status).toBe(400);
    expect(state.updated).toHaveBeenCalledWith({ status: "deleted" });
    expect(state.removed).toHaveBeenCalled();
    expect(state.updated).not.toHaveBeenCalledWith({ status: "ready" });
  });
  it("rejects invalid UTF-8 text even when the byte count matches", async () => {
    state.row!.kind = "text";
    state.row!.size_bytes = 2;
    state.size = 2;
    state.content = new Uint8Array([0xc3, 0x28]);
    expect((await complete(request(id), context)).status).toBe(400);
    expect(state.updated).not.toHaveBeenCalledWith({ status: "ready" });
  });
  it("completes file and UTF-8 text shares before allowing a download", async () => {
    for (const kind of ["file", "text"] as const) {
      state.row = { ...fixture(), kind };
      expect((await complete(request(id), context)).status).toBe(200);
      const response = await download(
        new Request("https://share.example"),
        context,
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(state.signed).toHaveBeenCalledWith(`${id}/object`, 60, {
        download: "hello.txt",
      });
    }
  });
  it("limits a signed download to the remaining share lifetime", async () => {
    state.row = {
      ...fixture(),
      status: "ready",
      expires_at: new Date(Date.now() + 20000).toISOString(),
    };
    await download(new Request("https://share.example"), context);
    const ttl = state.signed.mock.calls[0][1];
    expect(ttl).toBeGreaterThanOrEqual(18);
    expect(ttl).toBeLessThanOrEqual(20);
  });
  it("requires authentication to delete, then immediately hides a deleted share", async () => {
    state.row!.status = "ready";
    state.authenticated = false;
    expect((await remove(request(id), context)).status).toBe(401);
    expect(state.removed).not.toHaveBeenCalled();
    state.authenticated = true;
    expect((await remove(request(id), context)).status).toBe(200);
    await expect(getShare(id)).rejects.toMatchObject({ status: 404 });
  });
  it("protects cleanup even when no cron secret has been configured", async () => {
    delete process.env.CRON_SECRET;
    expect(
      (await cleanup(new Request("https://share.example/api/cleanup"))).status,
    ).toBe(401);
    process.env.CRON_SECRET = "test-secret";
    expect(
      (
        await cleanup(
          new Request("https://share.example/api/cleanup", {
            headers: { authorization: "Bearer wrong" },
          }),
        )
      ).status,
    ).toBe(401);
  });
});
