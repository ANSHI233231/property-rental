/**
 * GharSetu — Prisma seed script.
 *
 * Creates / refreshes the demo accounts. Idempotent — on re-run, password
 * hashes are rotated to the current env values so this script doubles as a
 * "reset all demo passwords" tool.
 *
 * Usage:
 *   pnpm prisma db seed
 *
 * Required env vars:
 *   BOOTSTRAP_ADMIN_EMAIL          — admin email (e.g. admin@triline.co)
 *   BOOTSTRAP_ADMIN_PASSWORD       — plaintext admin password
 *   SEED_TEST_PASSWORD             — plaintext password for non-admin demo accounts
 *
 * Optional:
 *   SEED_DEMO_DOMAIN               — domain for pm/maintenance/tenant demo
 *                                    accounts (default: "triline.co"). Three
 *                                    accounts are created using the exact
 *                                    local-parts the FE expects: pm@,
 *                                    maintance@, tennat@.
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

  console.log("[seed] Upserting bootstrap admin (password will be reset)...");

  const adminHash = await hashPassword(adminPassword);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    // Rotate password + ensure the account is enabled. This is what makes
    // re-running the seed equivalent to a password reset.
    update: { password_hash: adminHash, is_active: true },
    create: {
      email: adminEmail.toLowerCase(),
      name: "Admin",
      password_hash: adminHash,
      role: ROLE.ADMIN,
      is_active: true,
    },
  });

  console.log(`[seed] Admin: ${admin.email} (id: ${admin.id})`);

  if (!testPassword) {
    console.log("[seed] SEED_TEST_PASSWORD not set — skipping non-admin demo users.");
    return;
  }

  const testHash = await hashPassword(testPassword);
  const demoDomain = (process.env["SEED_DEMO_DOMAIN"] ?? "triline.co").toLowerCase();

  // Demo accounts the FE login screen uses. Local-parts intentionally match
  // the spellings already in use in the product ("maintance", "tennat").
  // Plus the legacy *.local accounts for compatibility with older tests.
  const testUsers = [
    { email: `pm@${demoDomain}`,        name: "Demo Property Manager", role: ROLE.PROPERTY_MANAGER },
    { email: `maintance@${demoDomain}`, name: "Demo Maintenance Staff", role: ROLE.MAINTENANCE },
    { email: `tennat@${demoDomain}`,    name: "Demo Tenant",            role: ROLE.TENANT },
    { email: "pm.test@gharsetu.local",          name: "Test Property Manager",   role: ROLE.PROPERTY_MANAGER },
    { email: "maintenance.test@gharsetu.local", name: "Test Maintenance Staff",  role: ROLE.MAINTENANCE },
    { email: "tenant.test@gharsetu.local",      name: "Test Tenant",             role: ROLE.TENANT },
  ];

  for (const u of testUsers) {
    const email = u.email.toLowerCase();
    const created = await prisma.user.upsert({
      where: { email },
      // Rotate password + ensure active on every run.
      update: { password_hash: testHash, is_active: true },
      create: {
        email,
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
