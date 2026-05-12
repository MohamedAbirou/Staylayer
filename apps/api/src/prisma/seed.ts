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
  FormEmailTemplateType,
  FormFieldType,
  FormType,
  PlatformRole,
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
  platformRole: PlatformRole | null = null,
): Promise<{ id: string; email: string; platformRole: PlatformRole | null }> {
  const emailVerifiedAt = platformRole ? null : new Date();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
      role: true,
      platformRole: true,
    },
  });
  if (existing) {
    const updates: {
      passwordHash?: string;
      emailVerifiedAt?: Date | null;
      role?: Role;
      platformRole?: PlatformRole | null;
    } = {};
    const passwordMatches = await argon2.verify(
      existing.passwordHash,
      password,
    );

    if (!passwordMatches) {
      updates.passwordHash = await hashPassword(password);
    }

    if (existing.role !== role) {
      updates.role = role;
    }

    if (existing.platformRole !== platformRole) {
      updates.platformRole = platformRole;
    }

    if (platformRole === null && existing.emailVerifiedAt === null) {
      updates.emailVerifiedAt = emailVerifiedAt;
    }

    if (Object.keys(updates).length > 0) {
      await prisma.user.update({
        where: { id: existing.id },
        data: updates,
      });
      console.log(`  [ok] user ${email} (${platformRole ?? "CUSTOMER"})`);
      return { id: existing.id, email: existing.email, platformRole };
    }

    console.log(`  [skip] user ${email} (${platformRole ?? "CUSTOMER"})`);
    return {
      id: existing.id,
      email: existing.email,
      platformRole: existing.platformRole,
    };
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, emailVerifiedAt, role, platformRole },
    select: { id: true, email: true, platformRole: true },
  });

  console.log(`  [ok] user ${email} (${platformRole ?? "CUSTOMER"})`);
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

async function upsertFormDefinitionBundle(input: {
  siteId: string;
  key: string;
  name: string;
  description: string;
  formType: FormType;
  assignment?: { pageSlugs?: string[]; locales?: string[] };
  fields: Array<{
    key: string;
    label: string;
    type: FormFieldType;
    required: boolean;
    placeholder?: string;
    helpText?: string;
  }>;
  routingRule: {
    name: string;
    pageSlug?: string;
    emailRecipients: string[];
    webhookUrl?: string;
    webhookSecret?: string;
    sendConfirmationEmail?: boolean;
    confirmationReplyToFieldKey?: string;
  };
}): Promise<void> {
  const existing = await prisma.formDefinition.findFirst({
    where: {
      siteId: input.siteId,
      key: input.key,
    },
    select: { id: true },
  });

  if (existing) {
    console.log(`  [skip] form ${input.key}`);
    return;
  }

  const definition = await prisma.formDefinition.create({
    data: {
      siteId: input.siteId,
      key: input.key,
      name: input.name,
      description: input.description,
      formType: input.formType,
      status: "ACTIVE",
      assignment: input.assignment ?? undefined,
    },
  });

  await prisma.formField.createMany({
    data: input.fields.map((field, index) => ({
      formDefinitionId: definition.id,
      key: field.key,
      label: field.label,
      placeholder: field.placeholder ?? "",
      helpText: field.helpText ?? "",
      type: field.type,
      required: field.required,
      sortOrder: index,
      isPlatformManaged: false,
    })),
  });

  const schemaSnapshot = {
    formDefinitionId: definition.id,
    key: input.key,
    name: input.name,
    description: input.description,
    formType: input.formType,
    assignment: input.assignment ?? null,
    fields: input.fields.map((field, index) => ({
      key: field.key,
      label: field.label,
      placeholder: field.placeholder ?? "",
      helpText: field.helpText ?? "",
      type: field.type,
      required: field.required,
      sortOrder: index,
      validation: null,
      options: [],
      defaultValue: null,
      isPlatformManaged: false,
      visibilityRules: null,
    })),
  };

  const version = await prisma.formSchemaVersion.create({
    data: {
      formDefinitionId: definition.id,
      versionNumber: 1,
      schemaSnapshot,
      routingSnapshot: [input.routingRule],
      publishedAt: new Date(),
      createdBy: "seed",
    },
  });

  await prisma.formDefinition.update({
    where: { id: definition.id },
    data: { activeSchemaVersionId: version.id },
  });

  await prisma.formRoutingRule.create({
    data: {
      siteId: input.siteId,
      formDefinitionId: definition.id,
      name: input.routingRule.name,
      pageSlug: input.routingRule.pageSlug ?? null,
      priority: 100,
      isActive: true,
      saveToInbox: true,
      emailRecipients: input.routingRule.emailRecipients,
      webhookUrl: input.routingRule.webhookUrl ?? "",
      webhookSecret: input.routingRule.webhookSecret ?? "",
      sendConfirmationEmail: input.routingRule.sendConfirmationEmail ?? false,
      confirmationReplyToFieldKey:
        input.routingRule.confirmationReplyToFieldKey ?? "email",
    },
  });

  console.log(`  [ok] form ${input.key}`);
}

async function upsertEmailStudioFixture(input: {
  siteId: string;
  brandName: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  typographyFamily: string;
  internalSubject: string;
  internalIntro: string;
  guestSubject: string;
  guestIntro: string;
  guestEnabled: boolean;
}): Promise<void> {
  await prisma.formEmailTheme.upsert({
    where: { siteId: input.siteId },
    create: {
      siteId: input.siteId,
      brandName: input.brandName,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      surfaceColor: input.surfaceColor,
      textColor: input.textColor,
      typographyFamily: input.typographyFamily,
      footerContent: { text: `Sent from ${input.brandName}` },
      updatedBy: "seed",
    },
    update: {
      brandName: input.brandName,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      surfaceColor: input.surfaceColor,
      textColor: input.textColor,
      typographyFamily: input.typographyFamily,
      footerContent: { text: `Sent from ${input.brandName}` },
      updatedBy: "seed",
    },
  });

  const existingTemplates = await prisma.formEmailTemplate.findMany({
    where: { siteId: input.siteId, formDefinitionId: null },
    select: { id: true, templateType: true },
  });
  const byType = new Map(
    existingTemplates.map((template) => [template.templateType, template.id]),
  );

  const templateConfigs = [
    {
      templateType: FormEmailTemplateType.INTERNAL_NOTIFICATION,
      name: "Seed internal notification",
      enabled: true,
      subjectTemplate: input.internalSubject,
      previewText: "A new inquiry has been submitted.",
      blocks: [
        { type: "brand_header", title: "New {{formName}} submission" },
        { type: "rich_text", text: input.internalIntro },
        { type: "field_list", title: "Submitted fields" },
        { type: "footer", text: `Sent from ${input.brandName}` },
      ],
      fieldOrder: ["name", "email", "message"],
    },
    {
      templateType: FormEmailTemplateType.GUEST_CONFIRMATION,
      name: "Seed guest confirmation",
      enabled: input.guestEnabled,
      subjectTemplate: input.guestSubject,
      previewText: "We received your message.",
      blocks: [
        { type: "brand_header", title: "Thanks for contacting {{siteName}}" },
        { type: "rich_text", text: input.guestIntro },
        { type: "field_list", title: "Your submission" },
        { type: "footer", text: `Sent from ${input.brandName}` },
      ],
      fieldOrder: ["name", "message"],
    },
  ] as const;

  for (const template of templateConfigs) {
    const existingId = byType.get(template.templateType);
    if (existingId) {
      await prisma.formEmailTemplate.update({
        where: { id: existingId },
        data: {
          name: template.name,
          enabled: template.enabled,
          subjectTemplate: template.subjectTemplate,
          previewText: template.previewText,
          blocks: template.blocks,
          fieldOrder: [...template.fieldOrder],
        },
      });
      continue;
    }

    await prisma.formEmailTemplate.create({
      data: {
        siteId: input.siteId,
        templateType: template.templateType,
        name: template.name,
        enabled: template.enabled,
        subjectTemplate: template.subjectTemplate,
        previewText: template.previewText,
        blocks: template.blocks,
        fieldOrder: [...template.fieldOrder],
      },
    });
  }

  console.log(`  [ok] email studio for ${input.siteId}`);
}

async function main(): Promise<void> {
  console.log("\nSeeding hospitality SaaS foundation...\n");

  console.log("Users:");
  await upsertUser(
    "superadmin@myallocator.com",
    "SuperAdmin123!",
    Role.SUPER_ADMIN,
    PlatformRole.PLATFORM_OWNER,
  );
  const opsAdmin = await upsertUser(
    "admin@myallocator.com",
    "Admin123!",
    Role.ADMIN,
    PlatformRole.SUPPORT_ADMIN,
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

  console.log("\nForm studio and email studio:");
  await upsertEmailStudioFixture({
    siteId: coastalSite.id,
    brandName: "Azure Bay Villas",
    logoUrl: "/images/azure-bay-logo.png",
    primaryColor: "#0f766e",
    accentColor: "#0f172a",
    surfaceColor: "#ffffff",
    textColor: "#0f172a",
    typographyFamily: "Georgia",
    internalSubject: "[{{siteName}}] New {{formName}} from {{name}}",
    internalIntro:
      "A new guest inquiry is ready for review. Prioritize direct-booking follow-up within one business day.",
    guestSubject: "We received your Azure Bay Villas request",
    guestIntro:
      "Thanks for contacting Azure Bay Villas. Our team will review your request and reply shortly.",
    guestEnabled: true,
  });
  await upsertFormDefinitionBundle({
    siteId: coastalSite.id,
    key: "coastal-general",
    name: "Coastal general inquiry",
    description: "Default contact form for general guest questions.",
    formType: FormType.CONTACT,
    assignment: { pageSlugs: ["home"], locales: ["en"] },
    fields: [
      {
        key: "name",
        label: "Name",
        type: FormFieldType.SINGLE_LINE_TEXT,
        required: true,
      },
      {
        key: "email",
        label: "Email",
        type: FormFieldType.EMAIL,
        required: true,
      },
      {
        key: "message",
        label: "Message",
        type: FormFieldType.MULTI_LINE_TEXT,
        required: true,
      },
    ],
    routingRule: {
      name: "General inquiries",
      pageSlug: "home",
      emailRecipients: ["hosts@azurebayvillas.com"],
      sendConfirmationEmail: true,
      confirmationReplyToFieldKey: "email",
    },
  });
  await upsertFormDefinitionBundle({
    siteId: coastalSite.id,
    key: "coastal-group-events",
    name: "Group events inquiry",
    description: "Captures retreat and event planning requests.",
    formType: FormType.GROUP_STAY,
    assignment: { pageSlugs: ["group-events"], locales: ["en"] },
    fields: [
      {
        key: "name",
        label: "Name",
        type: FormFieldType.SINGLE_LINE_TEXT,
        required: true,
      },
      {
        key: "email",
        label: "Email",
        type: FormFieldType.EMAIL,
        required: true,
      },
      {
        key: "eventDate",
        label: "Event date",
        type: FormFieldType.DATE,
        required: false,
      },
      {
        key: "groupSize",
        label: "Group size",
        type: FormFieldType.NUMBER,
        required: false,
      },
      {
        key: "message",
        label: "Event details",
        type: FormFieldType.MULTI_LINE_TEXT,
        required: true,
      },
    ],
    routingRule: {
      name: "Group events",
      pageSlug: "group-events",
      emailRecipients: [
        "events@azurebayvillas.com",
        "hosts@azurebayvillas.com",
      ],
      sendConfirmationEmail: true,
      confirmationReplyToFieldKey: "email",
    },
  });
  await upsertEmailStudioFixture({
    siteId: glampingSite.id,
    brandName: "Pine & Peak Glamping",
    logoUrl: "/images/pine-and-peak-logo.png",
    primaryColor: "#166534",
    accentColor: "#422006",
    surfaceColor: "#fffdf7",
    textColor: "#3f3f46",
    typographyFamily: "Trebuchet MS",
    internalSubject: "[{{siteName}}] {{formName}} from {{name}}",
    internalIntro:
      "A new forest-stay inquiry has arrived. Review the guest preferences and route to reservations.",
    guestSubject: "Your Pine & Peak request is in the queue",
    guestIntro:
      "Thanks for reaching out to Pine & Peak. We will confirm availability and next steps soon.",
    guestEnabled: true,
  });
  await upsertFormDefinitionBundle({
    siteId: glampingSite.id,
    key: "glamping-availability",
    name: "Availability request",
    description: "Primary availability request form for direct-booking leads.",
    formType: FormType.AVAILABILITY_REQUEST,
    assignment: { pageSlugs: ["home"], locales: ["en"] },
    fields: [
      {
        key: "name",
        label: "Name",
        type: FormFieldType.SINGLE_LINE_TEXT,
        required: true,
      },
      {
        key: "email",
        label: "Email",
        type: FormFieldType.EMAIL,
        required: true,
      },
      {
        key: "arrivalDate",
        label: "Arrival date",
        type: FormFieldType.DATE,
        required: true,
      },
      {
        key: "stayLength",
        label: "Number of nights",
        type: FormFieldType.NUMBER,
        required: true,
      },
      {
        key: "message",
        label: "Stay notes",
        type: FormFieldType.MULTI_LINE_TEXT,
        required: false,
      },
    ],
    routingRule: {
      name: "Availability requests",
      pageSlug: "home",
      emailRecipients: ["reservations@pineandpeak.com"],
      sendConfirmationEmail: true,
      confirmationReplyToFieldKey: "email",
    },
  });
  await upsertFormDefinitionBundle({
    siteId: glampingSite.id,
    key: "glamping-retreats",
    name: "Retreat and workshop inquiry",
    description: "Collects multi-guest retreat and workshop planning details.",
    formType: FormType.GROUP_STAY,
    assignment: { pageSlugs: ["retreats"], locales: ["en"] },
    fields: [
      {
        key: "name",
        label: "Organizer name",
        type: FormFieldType.SINGLE_LINE_TEXT,
        required: true,
      },
      {
        key: "email",
        label: "Email",
        type: FormFieldType.EMAIL,
        required: true,
      },
      {
        key: "groupSize",
        label: "Expected guests",
        type: FormFieldType.NUMBER,
        required: true,
      },
      {
        key: "message",
        label: "Retreat goals",
        type: FormFieldType.MULTI_LINE_TEXT,
        required: true,
      },
    ],
    routingRule: {
      name: "Retreat leads",
      pageSlug: "retreats",
      emailRecipients: [
        "retreats@pineandpeak.com",
        "reservations@pineandpeak.com",
      ],
      sendConfirmationEmail: true,
      confirmationReplyToFieldKey: "email",
    },
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
    root: { props: { title: "Home" } },
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
    root: { props: { title: "Home" } },
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
    { ...coastalHomePuckData, root: { props: { title: "Inicio" } } },
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
    "  │ Email                                  │ Password         │ Access scope │",
  );
  console.log(
    "  ├────────────────────────────────────────┼──────────────────┼─────────────┤",
  );
  console.log(
    "  │ superadmin@myallocator.com             │ SuperAdmin123!   │ PLATFORM_OWNER │",
  );
  console.log(
    "  │ admin@myallocator.com                  │ Admin123!        │ SUPPORT_ADMIN │",
  );
  console.log(
    "  │ owner@azurebayvillas.com               │ AzureBay123!     │ TENANT OWNER │",
  );
  console.log(
    "  │ owner@pineandpeak.com                  │ PinePeak123!     │ TENANT OWNER │",
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
