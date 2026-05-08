/**
 * Minimal seed script — creates a single "bare" customer user with no
 * tenant memberships so they can sign in and create a tenant/site themselves.
 *
 * Usage:
 *   pnpm --filter @myallocator/api db:seed:bare
 */

import { PrismaClient, Role } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const ARGON2_CONFIG: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function main(): Promise<void> {
  const email = "bare.customer@test.com";
  const password = "Customer123!";

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    console.log(`  [skip] user ${email} already exists`);
    return;
  }

  const passwordHash = await argon2.hash(password, ARGON2_CONFIG);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      // platformRole left null -> customer-only account (no platform privileges)
      // no tenant memberships created -> user has "literally nothing"
      role: Role.EDITOR,
    },
  });

  console.log(`  [ok] created bare customer user ${email}`);
  console.log(`  Password: ${password}`);
}

main()
  .catch((err) => {
    console.error("Seed-bare failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
