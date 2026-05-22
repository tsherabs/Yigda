import { Pool } from "pg";
import { hashPassword } from "@/lib/crypto";

let pool;
let schemaReady;

function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required. Add it to .env.local.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
      max: 5
    });
  }
  return pool;
}

export async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getPool();
      await db.query(`
        create extension if not exists pgcrypto;

        create table if not exists admins (
          id uuid primary key default gen_random_uuid(),
          username text unique not null,
          password_hash text not null,
          role text default 'admin',
          created_at timestamptz not null default now()
        );

        create table if not exists users (
          id uuid primary key default gen_random_uuid(),
          cid text unique not null,
          role text default 'user',
          org_id uuid,
          created_at timestamptz not null default now()
        );

        create table if not exists organizations (
          id uuid primary key default gen_random_uuid(),
          name text unique not null,
          type text,
          country text default 'Bhutan',
          logo_url text,
          password_hash text not null,
          status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
          approved_at timestamptz,
          created_at timestamptz not null default now()
        );

        create table if not exists document_types (
          id uuid primary key default gen_random_uuid(),
          name text unique not null,
          created_at timestamptz not null default now()
        );

        create table if not exists org_permissions (
          org_id uuid references organizations(id) on delete cascade,
          document_type text not null,
          primary key (org_id, document_type)
        );

        create table if not exists companies (
          id uuid primary key default gen_random_uuid(),
          name text unique not null,
          email text unique,
          country text,
          logo_url text,
          password_hash text not null,
          status text not null default 'active' check (status in ('active', 'suspended')),
          created_at timestamptz not null default now()
        );

        create table if not exists subscriptions (
          id uuid primary key default gen_random_uuid(),
          company_id uuid unique references companies(id) on delete cascade,
          plan text,
          start_date timestamptz,
          end_date timestamptz,
          verifications_limit integer,
          verifications_used integer not null default 0,
          status text not null default 'inactive',
          payment_status text,
          stripe_subscription_id text,
          created_at timestamptz not null default now()
        );

        create table if not exists documents (
          id uuid primary key default gen_random_uuid(),
          cid text not null,
          org_id uuid references organizations(id) on delete set null,
          document_type text not null,
          issue_date date not null,
          cloudinary_url text not null,
          doc_hash text unique not null,
          tx_hash text,
          status text not null default 'active' check (status in ('active', 'revoked')),
          revoke_reason text,
          revoked_at timestamptz,
          revoke_tx_hash text,
          created_at timestamptz not null default now()
        );

        create table if not exists shareable_links (
          id uuid primary key default gen_random_uuid(),
          token uuid unique not null default gen_random_uuid(),
          cid text not null,
          document_ids uuid[] not null,
          expires_at timestamptz not null,
          created_at timestamptz not null default now()
        );

        create table if not exists audit_logs (
          id uuid primary key default gen_random_uuid(),
          action text not null,
          entity_id text,
          performed_by uuid,
          ip_address text,
          meta jsonb,
          created_at timestamptz not null default now()
        );

        create table if not exists push_subscriptions (
          id uuid primary key default gen_random_uuid(),
          cid text not null,
          subscription jsonb not null,
          created_at timestamptz not null default now()
        );

        alter table organizations add column if not exists logo_url text;
        alter table companies add column if not exists logo_url text;
      `);

      await db.query(
        `
          insert into document_types (name)
          values
            ('Degree'),
            ('Transcript'),
            ('Medical Certificate'),
            ('Birth Certificate'),
            ('Vaccination Record'),
            ('Work Permit'),
            ('National ID')
          on conflict (name) do nothing
        `
      );

      const adminUsername = process.env.ADMIN_USERNAME || "admin";
      const adminPassword = process.env.ADMIN_PASSWORD || "zxcvbnm";
      await db.query(
        `
          insert into admins (username, password_hash)
          values ($1, $2)
          on conflict (username) do nothing
        `,
        [adminUsername, hashPassword(adminPassword)]
      );
    })();
  }
  await schemaReady;
}

export async function query(sql, params = []) {
  await ensureSchema();
  return getPool().query(sql, params);
}

export async function transaction(callback) {
  await ensureSchema();
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
