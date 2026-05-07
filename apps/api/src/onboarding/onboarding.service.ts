import { Injectable, NotFoundException } from "@nestjs/common";
import { OnboardingMilestoneKey, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export interface OnboardingMilestoneSummary {
  key: OnboardingMilestoneKey;
  completed: boolean;
  completedAt: string | null;
}

export interface OnboardingSnapshot {
  tenantId: string;
  startedAt: string;
  completedAt: string | null;
  milestones: OnboardingMilestoneSummary[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
}

const ALL_MILESTONES: OnboardingMilestoneKey[] = [
  OnboardingMilestoneKey.SITE_CREATED,
  OnboardingMilestoneKey.FIRST_PAGE_PUBLISHED,
  OnboardingMilestoneKey.DEPLOYMENT_PROVISIONED,
  OnboardingMilestoneKey.DOMAIN_CONNECTED,
  OnboardingMilestoneKey.SEO_COMPLETED,
  OnboardingMilestoneKey.FORM_CONFIGURED,
  OnboardingMilestoneKey.TRANSLATION_CONFIGURED,
];

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getSnapshot(tenantId: string): Promise<OnboardingSnapshot> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }

    const onboarding = await this.ensureOnboardingRecord(tenantId);
    await this.autoDetectMilestones(tenantId, onboarding.id);
    return this.buildSnapshot(tenantId);
  }

  async markMilestone(
    tenantId: string,
    milestone: OnboardingMilestoneKey,
    metadata?: Prisma.InputJsonValue,
  ): Promise<OnboardingSnapshot> {
    const onboarding = await this.ensureOnboardingRecord(tenantId);

    await this.prisma.tenantOnboardingMilestone.upsert({
      where: {
        onboardingId_milestone: {
          onboardingId: onboarding.id,
          milestone,
        },
      },
      create: {
        onboardingId: onboarding.id,
        milestone,
        metadata,
      },
      update: {
        metadata,
      },
    });

    await this.maybeCompleteOnboarding(onboarding.id);
    return this.buildSnapshot(tenantId);
  }

  private async ensureOnboardingRecord(tenantId: string) {
    const existing = await this.prisma.tenantOnboarding.findUnique({
      where: { tenantId },
      select: { id: true },
    });
    if (existing) {
      return existing;
    }
    return this.prisma.tenantOnboarding.create({
      data: { tenantId },
      select: { id: true },
    });
  }

  private async autoDetectMilestones(
    tenantId: string,
    onboardingId: string,
  ): Promise<void> {
    const [
      siteCount,
      publishedPageCount,
      liveDeploymentCount,
      activeDomainCount,
      configuredSeoCount,
      activeFormCount,
      translationChars,
    ] = await Promise.all([
      this.prisma.site.count({ where: { tenantId } }),
      this.prisma.page.count({
        where: {
          published: true,
          deletedAt: null,
          site: { tenantId },
        },
      }),
      this.prisma.deployment.count({
        where: { status: "LIVE", site: { tenantId } },
      }),
      this.prisma.domain.count({
        where: { status: "ACTIVE", site: { tenantId } },
      }),
      this.prisma.siteSettings.count({
        where: {
          site: { tenantId },
          NOT: { seoDefaultDesc: "" },
        },
      }),
      this.prisma.formDefinition.count({
        where: { status: "ACTIVE", site: { tenantId } },
      }),
      this.getTranslationCharsTotal(tenantId),
    ]);

    const updates: Array<{
      milestone: OnboardingMilestoneKey;
      completed: boolean;
    }> = [
      { milestone: OnboardingMilestoneKey.SITE_CREATED, completed: siteCount > 0 },
      {
        milestone: OnboardingMilestoneKey.FIRST_PAGE_PUBLISHED,
        completed: publishedPageCount > 0,
      },
      {
        milestone: OnboardingMilestoneKey.DEPLOYMENT_PROVISIONED,
        completed: liveDeploymentCount > 0,
      },
      {
        milestone: OnboardingMilestoneKey.DOMAIN_CONNECTED,
        completed: activeDomainCount > 0,
      },
      {
        milestone: OnboardingMilestoneKey.SEO_COMPLETED,
        completed: configuredSeoCount > 0,
      },
      {
        milestone: OnboardingMilestoneKey.FORM_CONFIGURED,
        completed: activeFormCount > 0,
      },
      {
        milestone: OnboardingMilestoneKey.TRANSLATION_CONFIGURED,
        completed: translationChars > 0,
      },
    ];

    await Promise.all(
      updates
        .filter((u) => u.completed)
        .map((u) =>
          this.prisma.tenantOnboardingMilestone.upsert({
            where: {
              onboardingId_milestone: {
                onboardingId,
                milestone: u.milestone,
              },
            },
            create: { onboardingId, milestone: u.milestone },
            update: {},
          }),
        ),
    );

    await this.maybeCompleteOnboarding(onboardingId);
  }

  private async maybeCompleteOnboarding(onboardingId: string): Promise<void> {
    const count = await this.prisma.tenantOnboardingMilestone.count({
      where: { onboardingId },
    });
    if (count >= ALL_MILESTONES.length) {
      await this.prisma.tenantOnboarding.updateMany({
        where: { id: onboardingId, completedAt: null },
        data: { completedAt: new Date() },
      });
    }
  }

  private async buildSnapshot(tenantId: string): Promise<OnboardingSnapshot> {
    const record = await this.prisma.tenantOnboarding.findUnique({
      where: { tenantId },
      include: {
        milestones: {
          select: { milestone: true, completedAt: true },
        },
      },
    });

    if (!record) {
      // Should never happen — ensureOnboardingRecord was called first.
      throw new NotFoundException({
        code: "ONBOARDING_NOT_FOUND",
        message: "Onboarding state not found",
      });
    }

    const completedMap = new Map<OnboardingMilestoneKey, Date>();
    for (const m of record.milestones) {
      completedMap.set(m.milestone, m.completedAt);
    }

    const milestones = ALL_MILESTONES.map<OnboardingMilestoneSummary>((key) => {
      const date = completedMap.get(key);
      return {
        key,
        completed: !!date,
        completedAt: date ? date.toISOString() : null,
      };
    });
    const completedCount = milestones.filter((m) => m.completed).length;

    return {
      tenantId,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt?.toISOString() ?? null,
      milestones,
      progress: {
        completed: completedCount,
        total: ALL_MILESTONES.length,
        percent: Math.round((completedCount / ALL_MILESTONES.length) * 100),
      },
    };
  }

  private async getTranslationCharsTotal(tenantId: string): Promise<number> {
    try {
      const aggregate = await this.prisma.translationUsage.aggregate({
        where: { tenantId },
        _sum: { characters: true },
      });
      return aggregate._sum.characters ?? 0;
    } catch {
      return 0;
    }
  }
}
