/**
 * GharSetu — Prisma seed script (Phase 1)
 *
 * Creates the bootstrap Admin user and dev/test users.
 * Idempotent: upserts by email.
 *
 * Usage:
 *   pnpm prisma db seed
 *
 * Required env vars:
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD
 *   SEED_TEST_PASSWORD  (used for PM / Maintenance / Tenant test accounts)
 */

import { PrismaClient } from "@prisma/client";
import { hash, Algorithm } from "@node-rs/argon2";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env relative to this script (apps/api/.env)
dotenv.config({ path: path.join(__dirname, "../.env") });

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  algorithm: Algorithm.Argon2id,
};

/** Role int codes — mirrors DB CASE WHEN convention in migration SQL */
const ROLE = {
  ADMIN: 0,
  PROPERTY_MANAGER: 1,
  MAINTENANCE: 2,
  TENANT: 3,
} as const;

async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTIONS);
}

async function main(): Promise<void> {
  const adminEmail = process.env["BOOTSTRAP_ADMIN_EMAIL"];
  const adminPassword = process.env["BOOTSTRAP_ADMIN_PASSWORD"];
  const testPassword = process.env["SEED_TEST_PASSWORD"];

  if (!adminEmail || !adminPassword) {
    console.error(
      "[seed] ERROR: BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set in environment.",
    );
    process.exit(1);
  }

  console.log("[seed] Creating bootstrap admin...");

  const adminHash = await hashPassword(adminPassword);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {},
    create: {
      email: adminEmail.toLowerCase(),
      name: "Admin",
      password_hash: adminHash,
      role: ROLE.ADMIN,
      is_active: true,
    },
  });

  console.log(`[seed] Admin: ${admin.email} (id: ${admin.id})`);

  // Dev/test users — only if SEED_TEST_PASSWORD is set
  if (!testPassword) {
    console.log("[seed] SEED_TEST_PASSWORD not set — skipping test users.");
    return;
  }

  const testHash = await hashPassword(testPassword);

  const testUsers = [
    {
      email: "pm.test@gharsetu.local",
      name: "Test Property Manager",
      role: ROLE.PROPERTY_MANAGER,
    },
    {
      email: "maintenance.test@gharsetu.local",
      name: "Test Maintenance Staff",
      role: ROLE.MAINTENANCE,
    },
    {
      email: "tenant.test@gharsetu.local",
      name: "Test Tenant",
      role: ROLE.TENANT,
    },
  ];

  for (const u of testUsers) {
    const created = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        password_hash: testHash,
        role: u.role,
        is_active: true,
        created_by_user_id: admin.id,
      },
    });
    console.log(`[seed] Role ${u.role}: ${created.email} (id: ${created.id})`);
  }

  console.log("[seed] Done.");
}

main()
  .catch((err: unknown) => {
    console.error("[seed] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
