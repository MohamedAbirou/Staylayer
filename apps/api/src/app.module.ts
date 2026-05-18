import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { OperatorAuthModule } from "./auth/operator/operator-auth.module";
import { UsersModule } from "./users/users.module";
import { PagesModule } from "./pages/pages.module";
import { RevalidationModule } from "./revalidation/revalidation.module";
import { HealthModule } from "./health/health.module";
import { SettingsModule } from "./settings/settings.module";
import { BillingModule } from "./billing/billing.module";
import { AdminModule } from "./admin/admin.module";
import { OperatorResourcesModule } from "./operator-resources/operator-resources.module";
import { SupportCasesModule } from "./support-cases/support-cases.module";
import { OperatorBillingModule } from "./operator-billing/operator-billing.module";
import { DeploymentsModule } from "./deployments/deployments.module";
import { DomainsModule } from "./domains/domains.module";
import { FormsModule } from "./forms/forms.module";
import { TenantWorkspaceModule } from "./tenant-workspace/tenant-workspace.module";
import { OnboardingModule } from "./onboarding/onboarding.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { PublicModule } from "./public/public.module";
import { PublicRuntimeModule } from "./public-runtime/public-runtime.module";
import { TranslationModule } from "./translation/translation.module";
import { SeoModule } from "./seo/seo.module";
import { ProfileModule } from "./profile/profile.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { MailModule } from "./mail/mail.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),
    ThrottlerModule.forRoot([
      // Short burst protection — raised to accommodate SPA concurrent requests
      { name: "burst", ttl: 1000, limit: 50 }, // 50 req / second

      // General default for normal endpoints (pages, users list, etc.)
      { name: "default", ttl: 60000, limit: 400 }, // 400 per minute for active editor use

      // Editor — very permissive to allow rapid edits, drag/drop, etc.
      { name: "editor", ttl: 10000, limit: 250 }, // 250 req / 10s → extremely permissive for editor actions

      // Login — very strict (brute-force protection)
      { name: "login", ttl: 300000, limit: 8 }, // 8 attempts per 5 minutes

      // Refresh — allow normal page reloads, multi-tab usage, and token rotation
      { name: "refresh", ttl: 3600000, limit: 180 }, // 180 per hour (~3 per minute average)
    ]),
    MailModule,
    PrismaModule,
    AuthModule,
    OperatorAuthModule,
    UsersModule,
    PagesModule,
    RevalidationModule,
    HealthModule,
    BillingModule,
    AdminModule,
    OperatorResourcesModule,
    SupportCasesModule,
    OperatorBillingModule,
    SettingsModule,
    DeploymentsModule,
    DomainsModule,
    FormsModule,
    TenantWorkspaceModule,
    OnboardingModule,
    NotificationsModule,
    PublicModule,
    PublicRuntimeModule,
    TranslationModule,
    SeoModule,
    ProfileModule,
  ],
  providers: [
    // Reactivate later if we want global throttling (currently we apply it at the controller level with @UseGuards(ThrottlerGuard) and @Throttle() decorators)
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
