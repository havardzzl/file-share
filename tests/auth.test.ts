import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  getUser: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.get,
    set: mocks.set,
    delete: mocks.delete,
  }),
}));
vi.mock("@/lib/supabase", () => ({
  isConfigured: () => true,
  authClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signInWithPassword: mocks.signIn,
      admin: { signOut: mocks.signOut },
    },
  }),
}));
import { isOwner, SESSION_COOKIE } from "@/lib/auth";
import { POST, DELETE } from "@/app/api/auth/route";
const user = { email: "owner@example.com", email_confirmed_at: "2026-01-01" };
function loginRequest(origin = "https://share.example") {
  return new Request("https://share.example/api/auth", {
    method: "POST",
    headers: { origin },
    body: JSON.stringify({ password: "a-strong-password" }),
  });
}
beforeEach(() => {
  process.env.OWNER_EMAIL = "owner@example.com";
  mocks.get.mockReturnValue({ value: "session-token" });
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.signIn.mockResolvedValue({
    data: {
      user,
      session: { access_token: "session-token", expires_in: 3600 },
    },
    error: null,
  });
});
describe("owner authentication", () => {
  it("never accepts a cookie without validating it with Supabase", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid"),
    });
    expect(await isOwner()).toBe(false);
    expect(mocks.getUser).toHaveBeenCalledWith("session-token");
  });
  it("rejects another user's valid session", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { ...user, email: "someone@example.com" } },
      error: null,
    });
    expect(await isOwner()).toBe(false);
  });
  it("rejects unconfirmed accounts", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { ...user, email_confirmed_at: null } },
      error: null,
    });
    expect(await isOwner()).toBe(false);
  });
  it("allows only the configured owner and uses an HttpOnly, SameSite cookie", async () => {
    expect(await isOwner()).toBe(true);
    expect((await POST(loginRequest())).status).toBe(200);
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "a-strong-password",
    });
    expect(mocks.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "session-token",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "strict",
        maxAge: 3600,
        path: "/",
      }),
    );
  });
  it("rejects login CSRF before checking a password", async () => {
    expect((await POST(loginRequest("https://evil.example"))).status).toBe(403);
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("does not set a session after an incorrect password", async () => {
    mocks.signIn.mockResolvedValue({ data: {}, error: { status: 400 } });
    expect((await POST(loginRequest())).status).toBe(401);
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it("removes the browser session on logout", async () => {
    const response = await DELETE(
      new Request("https://share.example/api/auth", {
        method: "DELETE",
        headers: { origin: "https://share.example" },
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.delete).toHaveBeenCalledWith(SESSION_COOKIE);
  });
});
