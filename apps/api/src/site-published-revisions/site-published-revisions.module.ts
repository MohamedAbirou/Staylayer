import { Module } from "@nestjs/common";

import { PrismaModule } from "../prisma/prisma.module";
import { SitePublishedRevisionsService } from "./site-published-revisions.service";

@Module({
  imports: [PrismaModule],
  providers: [SitePublishedRevisionsService],
  exports: [SitePublishedRevisionsService],
})
export class SitePublishedRevisionsModule {}
