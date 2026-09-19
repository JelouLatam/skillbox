import { randomBytes } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { clients, installCodes, profiles, users } from "./schema";
import { uniqueClient } from "./access";
import { Problem, sha256 } from "./library";
import { open, seal } from "./secret-storage";
import type { Principal } from "../shared";

export const MAX_ACTIVE_KEYS = 5;
const CODE_TTL_MS = 10 * 60 * 1000;

function ownerOf(p: Principal) {
  if (!p.id.startsWith("user:"))
    throw new Problem(400, "Personal keys need a Google sign-in");
  return p.id.slice(5);
}

async function profileFor(email: string) {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  const names = [
    ...(user?.role === "admin" ? [process.env.SKILLBOX_ADMIN_PROFILE] : []),
    ...(user?.role === "author" || user?.role === "admin"
      ? [process.env.SKILLBOX_AUTHOR_PROFILE]
      : []),
    process.env.SKILLBOX_MEMBER_PROFILE,
  ].filter((n): n is string => !!n);
  for (const name of names) {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.name, name));
    if (profile) return profile;
  }
  throw new Problem(
    503,
    "Personal keys are not set up yet. Ask an admin to set SKILLBOX_MEMBER_PROFILE.",
  );
}

export async function listMyKeys(p: Principal) {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      createdAt: clients.createdAt,
      lastSeen: sql<
        string | null
      >`(SELECT max(events.created_at) FROM events WHERE events.client_id=clients.id)`,
    })
    .from(clients)
    .where(and(eq(clients.ownerEmail, ownerOf(p)), eq(clients.active, true)))
    .orderBy(clients.createdAt);
}

export async function createMyKey(p: Principal, device: string) {
  const email = ownerOf(p);
  const active = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.ownerEmail, email), eq(clients.active, true)));
  if (active.length >= MAX_ACTIVE_KEYS)
    throw new Problem(
      409,
      `You already have ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`,
    );
  const name = `${device} · ${email}`;
  if (active.some((c) => c.name.toLowerCase() === name.toLowerCase()))
    throw new Problem(
      409,
      `You already have a key for "${device}". Revoke it first or use another name.`,
    );
  const profile = await profileFor(email);
  // Client names are unique across the workspace, so the owner is part of the name.
  const client = await uniqueClient(name, profile.id);
  await db
    .update(clients)
    .set({ ownerEmail: email })
    .where(eq(clients.id, client.id));
  const code = randomBytes(16).toString("base64url");
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  await db
    .delete(installCodes)
    .where(lt(installCodes.expiresAt, new Date().toISOString()));
  await db.insert(installCodes).values({
    hash: sha256(code),
    clientId: client.id,
    sealedKey: seal(client.token),
    expiresAt,
  });
  return { id: client.id, key: client.token, code, codeExpiresAt: expiresAt };
}

export async function revokeMyKey(p: Principal, id: string) {
  const email = ownerOf(p);
  const [row] = await db
    .update(clients)
    .set({ active: false })
    .where(and(eq(clients.id, id), eq(clients.ownerEmail, email)))
    .returning({ id: clients.id });
  if (!row) throw new Problem(404, "Key not found");
  await db.delete(installCodes).where(eq(installCodes.clientId, id));
}

/** Single use: the row is deleted in the same statement that reads it. */
export async function redeemInstallCode(code: string) {
  const [row] = await db
    .delete(installCodes)
    .where(
      and(
        eq(installCodes.hash, sha256(code)),
        gt(installCodes.expiresAt, new Date().toISOString()),
      ),
    )
    .returning();
  if (!row) throw new Problem(404, "This install code is invalid or expired");
  const [client] = await db
    .select({ active: clients.active, name: clients.name })
    .from(clients)
    .where(eq(clients.id, row.clientId));
  if (!client?.active)
    throw new Problem(404, "This install code is invalid or expired");
  return { key: open(row.sealedKey) as string, name: client.name };
}
