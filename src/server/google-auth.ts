import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { users } from "./schema";
import { adminEmails, appOrigin } from "./config";
import { Problem } from "./library";
import { rebindKeys } from "./personal-keys";
export { adminEmails };

export type UserRole = "admin" | "author" | "member";
export type User = typeof users.$inferSelect;

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const domain = process.env.SKILLBOX_GOOGLE_DOMAIN?.trim().toLowerCase();
  if (!clientId || !clientSecret || !domain) return null;
  return {
    clientId,
    clientSecret,
    domain,
    redirectUri: appOrigin() + "/api/auth/google/callback",
  };
}


export function startGoogleLogin() {
  const config = googleConfig();
  if (!config) throw new Problem(404, "Google sign-in is not configured");
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    hd: config.domain,
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), state, verifier };
}

export type GoogleIdentity = {
  email: string;
  name: string;
  emailVerified: boolean;
  hostedDomain?: string;
  audience: string;
  issuer: string;
};

export async function exchangeGoogleCode(code: string, verifier: string) {
  const config = googleConfig();
  if (!config) throw new Problem(404, "Google sign-in is not configured");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Problem(401, "Google sign-in failed");
  const { id_token } = (await response.json()) as { id_token?: string };
  // The ID token comes straight from Google's token endpoint over TLS, so its claims
  // can be trusted without verifying the signature (OpenID Connect Core §3.1.3.7).
  const payload = id_token?.split(".")[1];
  if (!payload) throw new Problem(401, "Google sign-in failed");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
  return {
    email: String(claims.email ?? "").toLowerCase(),
    name: String(claims.name ?? claims.email ?? ""),
    emailVerified: claims.email_verified === true,
    hostedDomain: claims.hd ? String(claims.hd).toLowerCase() : undefined,
    audience: String(claims.aud ?? ""),
    issuer: String(claims.iss ?? ""),
  } satisfies GoogleIdentity;
}

/** `hd` in the authorization request is only a hint; this is the actual domain check. */
export function assertAllowedIdentity(identity: GoogleIdentity) {
  const config = googleConfig();
  if (!config) throw new Problem(404, "Google sign-in is not configured");
  if (
    identity.audience !== config.clientId ||
    !["https://accounts.google.com", "accounts.google.com"].includes(
      identity.issuer,
    ) ||
    !identity.emailVerified ||
    identity.hostedDomain !== config.domain ||
    !identity.email.endsWith("@" + config.domain)
  )
    throw new Problem(403, `Only @${config.domain} accounts can sign in`);
}

export async function upsertUser(identity: GoogleIdentity): Promise<User> {
  const isAdmin = adminEmails().has(identity.email);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, identity.email));
  // SKILLBOX_ADMIN_EMAILS is the only source of admins, so removing an email demotes it.
  const role: UserRole = isAdmin
    ? "admin"
    : existing?.role === "author"
      ? "author"
      : "member";
  const [user] = await db
    .insert(users)
    .values({
      email: identity.email,
      name: identity.name,
      role,
      lastLoginAt: sql`now()` as unknown as string,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: identity.name, role, lastLoginAt: sql`now()` },
    })
    .returning();
  if (existing && existing.role !== role) await rebindKeys(user.email);
  return user;
}
