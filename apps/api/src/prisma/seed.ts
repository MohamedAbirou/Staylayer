/**
 * Database seed script
 *
 * Creates hospitality-focused tenants, sites, memberships, settings, and pages.
 * Safe to re-run — skips creation if the record already exists.
 *
 * Usage:
 *   pnpm --filter @myallocator/api db:seed
 */

import {
  PrismaClient,
  Role,
  SiteStatus,
  SiteType,
  TenantMembershipRole,
  TenantStatus,
} from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

const ARGON2_CONFIG: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_CONFIG);
}

async function upsertUser(
  email: string,
  password: string,
  role: Role,
): Promise<{ id: string; email: string; role: Role }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  [skip] user ${email} (${role})`);
    return { id: existing.id, email: existing.email, role: existing.role };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, role },
    select: { id: true, email: true, role: true },
  });

  console.log(`  [ok] user ${email} (${role})`);
  return user;
}

async function upsertTenant(
  slug: string,
  name: string,
): Promise<{ id: string; slug: string; name: string }> {
  const existing = await prisma.tenant.findUnique({ where: { slug } });
  if (existing) {
    console.log(`  [skip] tenant ${slug}`);
    return { id: existing.id, slug: existing.slug, name: existing.name };
  }

  const tenant = await prisma.tenant.create({
    data: {
      slug,
      name,
      status: TenantStatus.ACTIVE,
    },
    select: { id: true, slug: true, name: true },
  });

  console.log(`  [ok] tenant ${slug}`);
  return tenant;
}

async function upsertMembership(
  tenantId: string,
  userId: string,
  role: TenantMembershipRole,
  isDefault: boolean,
): Promise<void> {
  const existing = await prisma.tenantMembership.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });

  if (existing) {
    console.log(`  [skip] membership ${userId} -> ${tenantId}`);
    return;
  }

  await prisma.tenantMembership.create({
    data: {
      tenantId,
      userId,
      role,
      isDefault,
    },
  });

  console.log(`  [ok] membership ${userId} -> ${tenantId} (${role})`);
}

async function upsertSite(input: {
  tenantId: string;
  name: string;
  slug: string;
  templateKey: string;
  primaryLocale: string;
  enabledLocales: string[];
  siteType: SiteType;
}): Promise<{ id: string; slug: string; name: string }> {
  const existing = await prisma.site.findUnique({
    where: {
      tenantId_slug: {
        tenantId: input.tenantId,
        slug: input.slug,
      },
    },
  });

  if (existing) {
    console.log(`  [skip] site ${input.slug}`);
    return { id: existing.id, slug: existing.slug, name: existing.name };
  }

  const site = await prisma.site.create({
    data: {
      tenantId: input.tenantId,
      name: input.name,
      slug: input.slug,
      status: SiteStatus.ACTIVE,
      templateKey: input.templateKey,
      primaryLocale: input.primaryLocale,
      enabledLocales: input.enabledLocales,
      siteType: input.siteType,
    },
    select: { id: true, slug: true, name: true },
  });

  console.log(`  [ok] site ${input.slug}`);
  return site;
}

async function upsertSiteSettings(
  siteId: string,
  data: {
    siteName: string;
    siteSubtitle: string;
    supportEmail: string;
    publicPhone: string;
    whatsAppUrl: string;
    address: string;
    region: string;
    primaryCtaLabel: string;
    defaultInquiryRoutingEmail: string;
    seoTitleTemplate: string;
    seoDefaultDesc: string;
    defaultLocale: string;
    activeLocales: string[];
  },
): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { siteId },
    update: data,
    create: { siteId, ...data },
  });

  console.log(`  [ok] settings for ${siteId}`);
}

async function upsertPage(
  siteId: string,
  slug: string,
  locale: string,
  title: string,
  puckData: object,
  seoTitle: string,
  seoDescription: string,
  published: boolean,
  userId: string,
): Promise<void> {
  const existing = await prisma.page.findUnique({
    where: { siteId_slug_locale: { siteId, slug, locale } },
  });

  if (existing) {
    console.log(`  [skip] page ${siteId}:${slug}/${locale}`);
    return;
  }

  const page = await prisma.page.create({
    data: {
      siteId,
      slug,
      locale,
      title,
      puckData,
      seoTitle,
      seoDescription,
      published,
    },
  });

  await prisma.pageVersion.create({
    data: {
      pageId: page.id,
      puckData,
      savedBy: userId,
      note: "Initial seed version",
    },
  });

  console.log(`  [ok] page ${siteId}:${slug}/${locale}`);
}

async function main(): Promise<void> {
  console.log("\nSeeding hospitality SaaS foundation...\n");

  console.log("Users:");
  await upsertUser(
    "superadmin@myallocator.com",
    "SuperAdmin123!",
    Role.SUPER_ADMIN,
  );
  const opsAdmin = await upsertUser(
    "admin@myallocator.com",
    "Admin123!",
    Role.ADMIN,
  );
  const coastalOwner = await upsertUser(
    "owner@azurebayvillas.com",
    "AzureBay123!",
    Role.ADMIN,
  );
  const coastalEditor = await upsertUser(
    "editor@azurebayvillas.com",
    "AzureEdit123!",
    Role.EDITOR,
  );
  const glampingOwner = await upsertUser(
    "owner@pineandpeak.com",
    "PinePeak123!",
    Role.ADMIN,
  );

  console.log("\nTenants:");
  const coastalTenant = await upsertTenant(
    "azure-bay-hospitality",
    "Azure Bay Hospitality",
  );
  const glampingTenant = await upsertTenant(
    "pine-and-peak-hospitality",
    "Pine & Peak Hospitality",
  );

  console.log("\nMemberships:");
  await upsertMembership(
    coastalTenant.id,
    coastalOwner.id,
    TenantMembershipRole.OWNER,
    true,
  );
  await upsertMembership(
    coastalTenant.id,
    coastalEditor.id,
    TenantMembershipRole.EDITOR,
    false,
  );
  await upsertMembership(
    glampingTenant.id,
    glampingOwner.id,
    TenantMembershipRole.OWNER,
    true,
  );
  await upsertMembership(
    glampingTenant.id,
    opsAdmin.id,
    TenantMembershipRole.ADMIN,
    false,
  );

  console.log("\nSites:");
  const coastalSite = await upsertSite({
    tenantId: coastalTenant.id,
    name: "Azure Bay Villas",
    slug: "azure-bay-villas",
    templateKey: "vacation-rental-signature",
    primaryLocale: "en",
    enabledLocales: ["en", "es"],
    siteType: SiteType.VACATION_RENTAL,
  });
  const glampingSite = await upsertSite({
    tenantId: glampingTenant.id,
    name: "Pine & Peak Glamping",
    slug: "pine-and-peak-glamping",
    templateKey: "glamping-retreat",
    primaryLocale: "en",
    enabledLocales: ["en", "de"],
    siteType: SiteType.GLAMPING,
  });

  console.log("\nSite settings:");
  await upsertSiteSettings(coastalSite.id, {
    siteName: "Azure Bay Villas",
    siteSubtitle: "Oceanfront villa stays designed for direct guest inquiries",
    supportEmail: "stay@azurebayvillas.com",
    publicPhone: "+34 600 123 456",
    whatsAppUrl: "https://wa.me/34600123456",
    address: "Passeig de la Costa 18",
    region: "Costa Brava, Spain",
    primaryCtaLabel: "Send inquiry",
    defaultInquiryRoutingEmail: "hosts@azurebayvillas.com",
    seoTitleTemplate: "%s | Azure Bay Villas",
    seoDefaultDesc:
      "Oceanfront villas in Costa Brava with multilingual pages and direct guest inquiries.",
    defaultLocale: "en",
    activeLocales: ["en", "es"],
  });
  await upsertSiteSettings(glampingSite.id, {
    siteName: "Pine & Peak Glamping",
    siteSubtitle: "Forest-edge stays for inquiry-first glamping escapes",
    supportEmail: "hello@pineandpeak.com",
    publicPhone: "+49 151 555 7788",
    whatsAppUrl: "https://wa.me/491515557788",
    address: "Bergstrasse 41",
    region: "Black Forest, Germany",
    primaryCtaLabel: "Check availability",
    defaultInquiryRoutingEmail: "reservations@pineandpeak.com",
    seoTitleTemplate: "%s | Pine & Peak Glamping",
    seoDefaultDesc:
      "Inquiry-first glamping stays in the Black Forest with cabins, canvas suites, and group options.",
    defaultLocale: "en",
    activeLocales: ["en", "de"],
  });

  console.log("\nPages:");

  const coastalHomePuckData = {
    content: [
      {
        type: "HeroSection",
        props: {
          id: "hero-coastal-home",
          headline: "Oceanfront villas for relaxed, direct stays",
          subheadline:
            "Explore private villas, then send a direct inquiry for your preferred dates.",
          ctaLabel: "Send inquiry",
          ctaHref: "/contact",
          imageUrl: "/images/azure-bay-hero.jpg",
        },
      },
      {
        type: "ImageTextSection",
        props: {
          id: "coastal-story",
          title: "A quieter seaside stay, planned directly with our team",
          body: "Azure Bay Villas welcomes couples, families, and longer restorative stays with private terraces, chef-ready kitchens, and concierge-style local guidance.",
          imageUrl: "/images/azure-bay-story.jpg",
          imagePosition: "right",
        },
      },
    ],
    root: { title: "Home" },
  };

  const glampingHomePuckData = {
    content: [
      {
        type: "HeroSection",
        props: {
          id: "hero-glamping-home",
          headline: "Forest-edge glamping for guests who want to slow down",
          subheadline:
            "Choose your cabin or tent, then send an inquiry for dates, add-ons, and group stays.",
          ctaLabel: "Check availability",
          ctaHref: "/contact",
          imageUrl: "/images/pine-and-peak-hero.jpg",
        },
      },
      {
        type: "ImageTextSection",
        props: {
          id: "glamping-story",
          title: "Cabins, canvas suites, and small-group stays",
          body: "Pine & Peak mixes outdoor comfort with clear pre-arrival planning, multilingual content, and a direct inquiry flow for couples, families, and retreat organizers.",
          imageUrl: "/images/pine-and-peak-story.jpg",
          imagePosition: "left",
        },
      },
    ],
    root: { title: "Home" },
  };

  await upsertPage(
    coastalSite.id,
    "home",
    "en",
    "Azure Bay Villas | Coastal stays by direct inquiry",
    coastalHomePuckData,
    "Azure Bay Villas | Coastal stays by direct inquiry",
    "Oceanfront villas in Costa Brava with multilingual pages and direct guest inquiries.",
    true,
    coastalOwner.id,
  );

  await upsertPage(
    coastalSite.id,
    "home",
    "es",
    "Azure Bay Villas | Villas frente al mar por consulta directa",
    { ...coastalHomePuckData, root: { title: "Inicio" } },
    "Azure Bay Villas | Villas frente al mar por consulta directa",
    "Villas frente al mar en Costa Brava con contenido multilingue y consultas directas.",
    false,
    coastalOwner.id,
  );

  await upsertPage(
    glampingSite.id,
    "home",
    "en",
    "Pine & Peak Glamping | Forest stays by inquiry",
    glampingHomePuckData,
    "Pine & Peak Glamping | Forest stays by inquiry",
    "Inquiry-first glamping stays in the Black Forest with cabins, canvas suites, and group options.",
    true,
    glampingOwner.id,
  );

  console.log("\nSeed complete.\n");
  console.log("  Credentials for testing:");
  console.log(
    "  ┌────────────────────────────────────────┬──────────────────┬─────────────┐",
  );
  console.log(
    "  │ Email                                  │ Password         │ Role        │",
  );
  console.log(
    "  ├────────────────────────────────────────┼──────────────────┼─────────────┤",
  );
  console.log(
    "  │ superadmin@myallocator.com             │ SuperAdmin123!   │ SUPER_ADMIN │",
  );
  console.log(
    "  │ admin@myallocator.com                  │ Admin123!        │ ADMIN       │",
  );
  console.log(
    "  │ owner@azurebayvillas.com               │ AzureBay123!     │ ADMIN       │",
  );
  console.log(
    "  │ owner@pineandpeak.com                  │ PinePeak123!     │ ADMIN       │",
  );
  console.log(
    "  └────────────────────────────────────────┴──────────────────┴─────────────┘\n",
  );
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
