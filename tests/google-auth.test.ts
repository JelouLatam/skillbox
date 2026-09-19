import { afterAll, beforeAll, expect, test } from "bun:test";
import { migrate } from "../src/server/db";
import { app } from "../src/server/app";
import {
  assertAllowedIdentity,
  upsertUser,
  type GoogleIdentity,
} from "../src/server/google-auth";

const env = {
  GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-secret",
  SKILLBOX_GOOGLE_DOMAIN: "example.com",
  SKILLBOX_ADMIN_EMAILS: "Owner@example.com",
};
const previous = Object.fromEntries(
  Object.keys(env).map((k) => [k, process.env[k]]),
);
const realFetch = globalThis.fetch;

beforeAll(async () => {
  Object.assign(process.env, env);
  await migrate();
});
afterAll(() => {
  globalThis.fetch = realFetch;
  for (const [k, v] of Object.entries(previous))
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
});

const identity = (over: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
  email: "person@example.com",
  name: "Person",
  emailVerified: true,
  hostedDomain: "example.com",
  audience: env.GOOGLE_CLIENT_ID,
  issuer: "https://accounts.google.com",
  ...over,
});

test("only verified accounts of the configured Workspace domain are allowed", () => {
  expect(() => assertAllowedIdentity(identity())).not.toThrow();
  for (const bad of [
    identity({ emailVerified: false }),
    identity({ hostedDomain: undefined, email: "person@gmail.com" }),
    identity({ hostedDomain: undefined }),
    identity({ email: "person@example.com.evil.io" }),
    identity({ audience: "someone-else" }),
    identity({ issuer: "https://evil.example" }),
  ])
    expect(() => assertAllowedIdentity(bad)).toThrow("Only @example.com");
});

test("admins come only from SKILLBOX_ADMIN_EMAILS and authors are kept", async () => {
  expect(
    (await upsertUser(identity({ email: "owner@example.com" }))).role,
  ).toBe("admin");
  expect((await upsertUser(identity())).role).toBe("member");
  process.env.SKILLBOX_ADMIN_EMAILS = "";
  try {
    expect(
      (await upsertUser(identity({ email: "owner@example.com" }))).role,
    ).toBe("member");
  } finally {
    process.env.SKILLBOX_ADMIN_EMAILS = env.SKILLBOX_ADMIN_EMAILS;
  }
});

function idToken(claims: Record<string, unknown>) {
  const part = (v: unknown) =>
    Buffer.from(JSON.stringify(v)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

async function signIn(claims: Record<string, unknown>) {
  const start = await app.request("/api/auth/google");
  expect(start.status).toBe(302);
  const location = new URL(start.headers.get("location")!);
  expect(location.origin).toBe("https://accounts.google.com");
  expect(location.searchParams.get("hd")).toBe("example.com");
  expect(location.searchParams.get("code_challenge_method")).toBe("S256");
  const oauthCookie = start.headers.get("set-cookie")!.split(";")[0];
  globalThis.fetch = (async () =>
    Response.json({ id_token: idToken(claims) })) as unknown as typeof fetch;
  try {
    return await app.request(
      `/api/auth/google/callback?code=abc&state=${location.searchParams.get("state")}`,
      { headers: { Cookie: oauthCookie } },
    );
  } finally {
    globalThis.fetch = realFetch;
  }
}

const claims = (email: string, hd = "example.com") => ({
  email,
  name: email.split("@")[0],
  email_verified: true,
  hd,
  aud: env.GOOGLE_CLIENT_ID,
  iss: "https://accounts.google.com",
});

test("callback creates a member session that can read but not administer", async () => {
  const res = await signIn(claims("reader@example.com"));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/");
  const session = res.headers
    .getSetCookie()
    .find((c) => c.startsWith("skillbox_session="))!
    .split(";")[0];
  const me = await app.request("/api/me", { headers: { Cookie: session } });
  expect(await me.json()).toEqual({
    name: "reader",
    role: "reader",
    email: "reader@example.com",
  });
  expect(
    (await app.request("/api/skills", { headers: { Cookie: session } })).status,
  ).toBe(200);
  expect(
    (await app.request("/api/clients", { headers: { Cookie: session } }))
      .status,
  ).toBe(403);
});

test("callback rejects other domains and forged state", async () => {
  const other = await signIn(claims("someone@gmail.com", ""));
  expect(other.headers.get("location")).toContain("auth_error=");
  expect(other.headers.getSetCookie().join()).not.toContain(
    "skillbox_session=",
  );
  const forged = await app.request(
    "/api/auth/google/callback?code=abc&state=forged",
    { headers: { Cookie: "skillbox_oauth=real.verifier" } },
  );
  expect(forged.headers.get("location")).toContain("auth_error=");
});

test("admins promote members to authors; admin roles stay in the environment", async () => {
  await upsertUser(identity({ email: "writer@example.com" }));
  const admin = {
    Authorization: "Bearer " + process.env.SKILLBOX_ADMIN_TOKEN,
    "Content-Type": "application/json",
  };
  const promote = await app.request("/api/users/writer@example.com", {
    method: "PATCH",
    headers: admin,
    body: JSON.stringify({ role: "author" }),
  });
  expect((await promote.json()).role).toBe("author");
  expect(
    (await upsertUser(identity({ email: "writer@example.com" }))).role,
  ).toBe("author");
  const demoteAdmin = await app.request("/api/users/owner@example.com", {
    method: "PATCH",
    headers: admin,
    body: JSON.stringify({ role: "member" }),
  });
  expect(demoteAdmin.status).toBe(409);
});
