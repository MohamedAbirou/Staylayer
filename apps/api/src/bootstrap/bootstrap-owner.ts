/**
 * One-time PLATFORM_OWNER bootstrap.
 *
 * Creates the very first operator-console user on a fresh deployment so
 * the platform team can sign in and create the rest of the operator
 * accounts through the normal `/operator/users` flow.
 *
 * SECURITY MODEL
 * --------------
 * This script REFUSES to do anything if **any** `PLATFORM_OWNER` row
 * already exists. That makes it safe to leave wired into deployment
 * tooling: after the first successful run it becomes a no-op and cannot
 * be abused to escalate privileges later.
 *
 * Inputs (read from environment, never from CLI args or stdin so the
 * password never lands in shell history):
 *
 *   BOOTSTRAP_OWNER_EMAIL     — email address for the new owner.
 *   BOOTSTRAP_OWNER_PASSWORD  — initial password. Must satisfy the same
 *                               complexity rules the operator UI enforces.
 *
 * Usage:
 *
 *   $env:BOOTSTRAP_OWNER_EMAIL    = "ops@yourcompany.com"
 *   $env:BOOTSTRAP_OWNER_PASSWORD = "<strong password>"
 *   pnpm --filter @staylayer/api bootstrap:owner
 *
 * The new user has no MFA enrolled — they enroll via the existing
 * `/operator/auth/mfa/enroll` flow on first login.
 */

import { PlatformRole, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";

const ARGON2_CONFIG: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

const PASSWORD_MIN = 12;

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN)
    return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Z]/.test(password))
    return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password))
    return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a digit.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a symbol.";
  return null;
}

function validateEmail(email: string): boolean {
  // Minimal sanity check — the customer/operator flows already enforce
  // stricter rules at the API surface. This script is only used by a
  // human operator running it manually.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function main(): Promise<void> {
  const email = (process.env.BOOTSTRAP_OWNER_EMAIL ?? "").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD ?? "";

  if (!email || !password) {
    console.error(
      "[bootstrap-owner] BOOTSTRAP_OWNER_EMAIL and BOOTSTRAP_OWNER_PASSWORD must both be set.",
    );
    process.exit(1);
  }

  if (!validateEmail(email)) {
    console.error(
      "[bootstrap-owner] BOOTSTRAP_OWNER_EMAIL is not a valid email address.",
    );
    process.exit(1);
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    console.error(`[bootstrap-owner] ${passwordError}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const existingOwner = await prisma.user.findFirst({
      where: { platformRole: PlatformRole.PLATFORM_OWNER },
      select: { id: true, email: true },
    });

    if (existingOwner) {
      console.error(
        "[bootstrap-owner] Refusing to run: a PLATFORM_OWNER already exists. " +
          "Use the operator console at /operator-users to manage additional users.",
      );
      process.exit(2);
    }

    const conflicting = await prisma.user.findUnique({
      where: { email },
      select: { id: true, platformRole: true },
    });

    if (conflicting) {
      console.error(
        `[bootstrap-owner] A user with email ${email} already exists ` +
          `(platformRole=${conflicting.platformRole ?? "null"}). ` +
          "Pick a fresh, dedicated operator email — customer accounts must never be reused.",
      );
      process.exit(3);
    }

    const passwordHash = await argon2.hash(password, ARGON2_CONFIG);

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        platformRole: PlatformRole.PLATFORM_OWNER,
        emailVerifiedAt: null,
      },
      select: { id: true, email: true, createdAt: true },
    });

    console.log(
      `[bootstrap-owner] PLATFORM_OWNER created id=${created.id} email=${created.email}`,
    );
    console.log(
      "[bootstrap-owner] Next steps:\n" +
        "  1. Sign in at the operator console with this email and password.\n" +
        "  2. Enroll MFA immediately via /operator/auth/mfa/enroll.\n" +
        "  3. Store the recovery codes in your password manager.\n" +
        "  4. Create the rest of your operator users from /operator-users.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[bootstrap-owner] Unexpected error:", err);
  process.exit(10);
});
