import { Module } from "@nestjs/common";
import { SeoController } from "./seo.controller";
import { SeoService } from "./seo.service";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { BillingModule } from "../billing/billing.module";
import { RobotsController } from "./robots/robots.controller";
import { RobotsService } from "./robots/robots.service";
import { SitemapController } from "./sitemap/sitemap.controller";
import { SitemapService } from "./sitemap/sitemap.service";
import { IndexNowController } from "./indexnow/indexnow.controller";
import { IndexNowService } from "./indexnow/indexnow.service";
import { CrawlerController } from "./crawler/crawler.controller";
import { CrawlerService } from "./crawler/crawler.service";
import { LinkGraphService } from "./crawler/link-graph.service";
import { SearchConsoleController } from "./search-console/search-console.controller";
import { SearchConsoleService } from "./search-console/search-console.service";
import { SearchConsoleApiService } from "./search-console/search-console-api.service";
import { SearchConsoleOAuthService } from "./search-console/search-console-oauth.service";
import { SearchConsoleSyncService } from "./search-console/search-console-sync.service";
import { SearchConsoleCronService } from "./search-console/search-console-cron.service";
import { SeoTokenEncryptionService } from "./search-console/search-console-encryption.service";
import { PsiController } from "./psi/psi.controller";
import { PsiAuditService } from "./psi/psi.service";
import { PageSpeedInsightsClient } from "./psi/psi-api.service";
import { HreflangController } from "./hreflang/hreflang.controller";
import { HreflangScanService } from "./hreflang/hreflang.service";
import { PageSchemaController } from "./page-schema/page-schema.controller";
import { PageSchemaService } from "./page-schema/page-schema.service";
import { ImageAuditController } from "./images/image-audit.controller";
import { ImageAuditService } from "./images/image-audit.service";
import { BingWebmasterController } from "./bing-webmaster/bing-webmaster.controller";
import { BingWebmasterService } from "./bing-webmaster/bing-webmaster.service";
import { BingWebmasterApiService } from "./bing-webmaster/bing-webmaster-api.service";
import { BingWebmasterSyncService } from "./bing-webmaster/bing-webmaster-sync.service";
import { BingWebmasterCronService } from "./bing-webmaster/bing-webmaster-cron.service";
import { RedirectMigrationService } from "./redirect-migration/redirect-migration.service";
import { AiCitationController } from "./ai-citation/ai-citation.controller";
import { AiCitationService } from "./ai-citation/ai-citation.service";
import { ScheduledAuditsController } from "./scheduled-audits/scheduled-audits.controller";
import { SeoAuditScheduleService } from "./scheduled-audits/scheduled-audits-schedule.service";
import { SeoAuditRunnerService } from "./scheduled-audits/scheduled-audits-runner.service";
import { SeoAuditQueryService } from "./scheduled-audits/scheduled-audits-query.service";
import { SeoAuditCronService } from "./scheduled-audits/scheduled-audits-cron.service";
import { AuditTasksController } from "./audit-tasks/audit-tasks.controller";
import { SeoAuditTasksService } from "./audit-tasks/audit-tasks.service";

@Module({
  imports: [PrismaModule, AuthModule, BillingModule],
  controllers: [
    SeoController,
    RobotsController,
    SitemapController,
    IndexNowController,
    CrawlerController,
    SearchConsoleController,
    PsiController,
    HreflangController,
    PageSchemaController,
    ImageAuditController,
    BingWebmasterController,
    AiCitationController,
    ScheduledAuditsController,
    AuditTasksController,
  ],
  providers: [
    SeoService,
    RobotsService,
    SitemapService,
    IndexNowService,
    CrawlerService,
    LinkGraphService,
    SeoTokenEncryptionService,
    SearchConsoleOAuthService,
    SearchConsoleApiService,
    SearchConsoleSyncService,
    SearchConsoleService,
    SearchConsoleCronService,
    PageSpeedInsightsClient,
    PsiAuditService,
    HreflangScanService,
    PageSchemaService,
    ImageAuditService,
    BingWebmasterApiService,
    BingWebmasterSyncService,
    BingWebmasterService,
    BingWebmasterCronService,
    RedirectMigrationService,
    AiCitationService,
    SeoAuditScheduleService,
    SeoAuditRunnerService,
    SeoAuditQueryService,
    SeoAuditCronService,
    SeoAuditTasksService,
  ],
  exports: [
    SeoService,
    RobotsService,
    SitemapService,
    IndexNowService,
    SearchConsoleService,
    PsiAuditService,
    HreflangScanService,
    ImageAuditService,
    BingWebmasterService,
    RedirectMigrationService,
    AiCitationService,
    SeoAuditScheduleService,
    SeoAuditRunnerService,
    SeoAuditQueryService,
    SeoAuditTasksService,
  ],
})
export class SeoModule {}
