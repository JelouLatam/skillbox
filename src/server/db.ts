import { packageMetrics } from "../package-metrics";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { AsyncLocalStorage } from "node:async_hooks";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import * as schema from "./schema";

type Row = Record<string, any>;
type Query = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Row[]>;
export type Sql = Query & {
  begin<T>(fn: (tx: Query) => Promise<T>): Promise<T>;
  end(): Promise<void>;
};

function pgliteQuery(client: Pick<PGlite, "query">): Query {
  return async (strings, ...values) => {
    const text = strings.reduce((a, s, i) => a + "$" + i + s);
    return (await client.query<Row>(text, values)).rows;
  };
}

function openDatabase() {
  if (process.env.DATABASE_URL) {
    const client = postgres(process.env.DATABASE_URL, {
      max: 8,
      onnotice: () => {},
    });
    return {
      connection: client as unknown as Sql,
      db: drizzle(client, { schema }),
    };
  }
  // PGlite is one in-process backend: exactly one process may open a data directory.
  const pg = new PGlite(process.env.SKILLBOX_DATA_DIR, {
    // PGlite passes -F (fsync off) by default; a stopped Fly machine must not lose commits.
    startParams: PGlite.defaultStartParams.filter((p) => p !== "-F"),
    postgresqlconf: [
      "shared_buffers = 16MB",
      "work_mem = 4MB",
      "maintenance_work_mem = 16MB",
      "wal_buffers = 1MB",
    ],
  });
  // A single backend means a query outside an open transaction waits for it to end. Code that
  // reaches the global `db` from inside a transaction would deadlock, so it joins that transaction.
  const active = new AsyncLocalStorage<Transaction>();
  const current = () => {
    const tx = active.getStore();
    return tx && !tx.closed ? tx : pg;
  };
  const client = {
    query: ((...args: Parameters<PGlite["query"]>) =>
      current().query(...args)) as PGlite["query"],
    exec: ((...args: Parameters<PGlite["exec"]>) =>
      current().exec(...args)) as PGlite["exec"],
    transaction: <T>(fn: (tx: Transaction) => Promise<T>) => {
      const tx = active.getStore();
      if (tx && !tx.closed) return fn(tx);
      return pg.transaction((tx) => active.run(tx, () => fn(tx)));
    },
  };
  const connection = Object.assign(pgliteQuery(client), {
    begin: <T>(fn: (tx: Query) => Promise<T>) =>
      client.transaction((tx) => fn(pgliteQuery(tx))),
    end: () => pg.close(),
  });
  return {
    connection,
    db: drizzlePglite({
      client: client as unknown as PGlite,
      schema,
    }) as unknown as ReturnType<typeof drizzle<typeof schema>>,
  };
}

export const { connection, db } = openDatabase();

/** postgres-js returns rows directly; PGlite wraps them in `{ rows }`. */
export const rowsOf = <T = Row>(result: unknown): T[] =>
  (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];

export async function migrate() {
  await connection`CREATE TABLE IF NOT EXISTS skills (id text PRIMARY KEY,title text NOT NULL,description text NOT NULL,tags jsonb NOT NULL DEFAULT '[]',revision text NOT NULL,search_text text NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`;
  await connection`ALTER TABLE skills ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'skill', ADD COLUMN IF NOT EXISTS members jsonb NOT NULL DEFAULT '[]', ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS replacement text`;
  await connection`ALTER TABLE skills ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false`;
  await connection`ALTER TABLE skills ADD COLUMN IF NOT EXISTS icon jsonb`;
  await connection`CREATE TABLE IF NOT EXISTS revisions (id text PRIMARY KEY,skill_id text NOT NULL REFERENCES skills(id),metadata jsonb NOT NULL,files jsonb NOT NULL,checksum text NOT NULL,message text NOT NULL,author text NOT NULL,created_at timestamptz NOT NULL DEFAULT now())`;
  await connection`CREATE INDEX IF NOT EXISTS revisions_skill_idx ON revisions(skill_id)`;
  await connection`CREATE INDEX IF NOT EXISTS skills_search_idx ON skills USING gin(to_tsvector('english',search_text))`;
  await connection`CREATE TABLE IF NOT EXISTS clients (id text PRIMARY KEY,name text NOT NULL,token_hash text NOT NULL UNIQUE,role text NOT NULL DEFAULT 'reader',all_skills boolean NOT NULL DEFAULT false,skill_ids jsonb NOT NULL DEFAULT '[]',active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now())`;
  await connection`CREATE TABLE IF NOT EXISTS profiles (id text PRIMARY KEY,name text NOT NULL,all_skills boolean NOT NULL DEFAULT false,skill_ids jsonb NOT NULL DEFAULT '[]',permissions jsonb NOT NULL,version text NOT NULL DEFAULT gen_random_uuid()::text)`;
  await connection`ALTER TABLE clients ADD COLUMN IF NOT EXISTS profile_id text REFERENCES profiles(id)`;
  // Equivalent legacy grants share a profile. Tokens and client identity never change.
  await connection.begin(async (tx) => {
    const legacy =
      await tx`SELECT * FROM clients WHERE profile_id IS NULL ORDER BY created_at,id FOR UPDATE`;
    for (const c of legacy) {
      const permissions = {
        create: c.role === "writer",
        update: c.role === "writer",
        delete: false,
        propose: false,
      };
      const grants = [...c.skill_ids].sort();
      const id =
        "legacy-" +
        Bun.hash(JSON.stringify([c.all_skills, grants, permissions])).toString(
          16,
        );
      const name = c.all_skills
        ? c.role === "writer"
          ? "Library editors"
          : "Library readers"
        : c.name;
      await tx`INSERT INTO profiles (id,name,all_skills,skill_ids,permissions) VALUES (${id},${name},${c.all_skills},${JSON.stringify(grants)}::jsonb,${JSON.stringify(permissions)}::jsonb) ON CONFLICT (id) DO NOTHING`;
      await tx`UPDATE clients SET profile_id=${id} WHERE id=${c.id}`;
    }
  });
  await connection`ALTER TABLE clients ALTER COLUMN profile_id SET NOT NULL`;
  await connection`CREATE TABLE IF NOT EXISTS proposals (id text PRIMARY KEY,skill_id text NOT NULL,client_id text NOT NULL,client_name text NOT NULL,expected_revision text NOT NULL,files jsonb NOT NULL,message text NOT NULL,status text NOT NULL DEFAULT 'pending',created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,reviewer text,published_revision text)`;
  await connection`CREATE TABLE IF NOT EXISTS sessions (hash text PRIMARY KEY,expires_at timestamptz NOT NULL)`;
  await connection`CREATE TABLE IF NOT EXISTS events (id text PRIMARY KEY,client_id text NOT NULL,client_name text NOT NULL,operation text NOT NULL,skill_id text,created_at timestamptz NOT NULL DEFAULT now())`;
  await connection`CREATE INDEX IF NOT EXISTS events_skill_access_idx ON events(skill_id, created_at DESC) WHERE operation IN ('load', 'read_file', 'bundle')`;
  await connection`ALTER TABLE events ADD COLUMN IF NOT EXISTS context jsonb NOT NULL DEFAULT '{}'`;
  await connection`CREATE TABLE IF NOT EXISTS workspace_settings (id text PRIMARY KEY, value jsonb NOT NULL)`;
  await connection`ALTER TABLE skills ADD COLUMN IF NOT EXISTS package_metrics jsonb`;
  const unmeasured =
    await connection`SELECT s.id,s.revision,r.files FROM skills s JOIN revisions r ON r.id=s.revision WHERE s.package_metrics IS NULL`;
  for (const row of unmeasured)
    await connection`UPDATE skills SET package_metrics=${JSON.stringify(packageMetrics(row.files))}::jsonb WHERE id=${row.id} AND revision=${row.revision}`;
  await connection`CREATE TABLE IF NOT EXISTS users (email text PRIMARY KEY,name text NOT NULL,role text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),last_login_at timestamptz)`;
  await connection`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_email text REFERENCES users(email) ON DELETE CASCADE`;
  await connection`ALTER TABLE clients ADD COLUMN IF NOT EXISTS owner_email text`;
  await connection`CREATE INDEX IF NOT EXISTS clients_owner_idx ON clients(owner_email) WHERE owner_email IS NOT NULL`;
  await connection`CREATE TABLE IF NOT EXISTS install_codes (hash text PRIMARY KEY,client_id text NOT NULL REFERENCES clients(id),sealed_key jsonb NOT NULL,expires_at timestamptz NOT NULL)`;
  await connection`ALTER TABLE skills ADD COLUMN IF NOT EXISTS reference_id text NOT NULL DEFAULT gen_random_uuid()::text`;
  await connection`CREATE UNIQUE INDEX IF NOT EXISTS skills_reference_id_idx ON skills(reference_id)`;
}
