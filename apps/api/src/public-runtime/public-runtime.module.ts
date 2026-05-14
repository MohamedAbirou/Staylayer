import { Module } from "@nestjs/common";
import { FormsModule } from "../forms/forms.module";
import { PrismaModule } from "../prisma/prisma.module";
import { SeoModule } from "../seo/seo.module";
import { HostResolutionService } from "./host-resolution.service";
import { PreviewTokenService } from "./preview-token.service";
import { PublicRuntimeCacheService } from "./public-runtime.cache.service";
import { PublicRuntimeController } from "./public-runtime.controller";
import { PublicRuntimeService } from "./public-runtime.service";

@Module({
  imports: [PrismaModule, FormsModule, SeoModule],
  controllers: [PublicRuntimeController],
  providers: [
    PublicRuntimeCacheService,
    PreviewTokenService,
    HostResolutionService,
    PublicRuntimeService,
  ],
  exports: [
    PreviewTokenService,
    HostResolutionService,
    PublicRuntimeService,
    PublicRuntimeCacheService,
  ],
})
export class PublicRuntimeModule {}
