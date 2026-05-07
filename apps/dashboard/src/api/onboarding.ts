import client from "./client";

export type OnboardingMilestoneKey =
  | "SITE_CREATED"
  | "FIRST_PAGE_PUBLISHED"
  | "DEPLOYMENT_PROVISIONED"
  | "DOMAIN_CONNECTED"
  | "SEO_COMPLETED"
  | "FORM_CONFIGURED"
  | "TRANSLATION_CONFIGURED";

export interface OnboardingMilestone {
  key: OnboardingMilestoneKey;
  completed: boolean;
  completedAt: string | null;
}

export interface OnboardingSnapshot {
  tenantId: string;
  startedAt: string;
  completedAt: string | null;
  milestones: OnboardingMilestone[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
}

export const MILESTONE_META: Record<
  OnboardingMilestoneKey,
  { title: string; description: string; href: string }
> = {
  SITE_CREATED: {
    title: "Create your first site",
    description: "Spin up a hospitality site to hold your pages and content.",
    href: "/workspace",
  },
  FIRST_PAGE_PUBLISHED: {
    title: "Publish your first page",
    description: "Build and publish at least one page in the Puck editor.",
    href: "/pages",
  },
  DEPLOYMENT_PROVISIONED: {
    title: "Deploy to the web",
    description: "Provision a live deployment so visitors can reach your site.",
    href: "/deployments",
  },
  DOMAIN_CONNECTED: {
    title: "Connect a custom domain",
    description: "Verify DNS and attach your own domain to the site.",
    href: "/domains",
  },
  SEO_COMPLETED: {
    title: "Complete your SEO basics",
    description: "Set the site description, title template, and OG image.",
    href: "/settings",
  },
  FORM_CONFIGURED: {
    title: "Configure an inquiry form",
    description: "Turn on an active form and add routing so inquiries reach you.",
    href: "/forms",
  },
  TRANSLATION_CONFIGURED: {
    title: "Try multilingual publishing",
    description: "Translate a page into another supported language.",
    href: "/pages",
  },
};

export async function getOnboarding(
  tenantId: string,
): Promise<OnboardingSnapshot> {
  const { data } = await client.get<OnboardingSnapshot>(
    `/tenants/${tenantId}/onboarding`,
  );
  return data;
}

export async function markOnboardingMilestone(
  tenantId: string,
  milestone: OnboardingMilestoneKey,
): Promise<OnboardingSnapshot> {
  const { data } = await client.post<OnboardingSnapshot>(
    `/tenants/${tenantId}/onboarding/milestones`,
    { milestone },
  );
  return data;
}
