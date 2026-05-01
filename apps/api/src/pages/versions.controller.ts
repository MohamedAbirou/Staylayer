import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Request } from "express";
import { Role } from "@prisma/client";
import { VersionsService } from "./versions.service";
import { PageLocaleQueryDto, VersionQueryDto } from "./dto/page-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";

@Controller("pages/:slug/versions")
@UseGuards(JwtAuthGuard)
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  @Get()
  async listVersions(
    @Param("slug") slug: string,
    @Query() query: VersionQueryDto,
  ): Promise<{
    data: { id: string; savedBy: string; note: string | null; savedAt: Date }[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.versionsService.listVersions(
      query.siteId,
      slug,
      query.locale || "en",
      query.page,
      query.limit,
    );
  }

  @Post(":id/restore")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async restoreVersion(
    @Param("slug") slug: string,
    @Param("id") versionId: string,
    @Query() query: PageLocaleQueryDto,
    @Req() req: Request,
  ): Promise<Record<string, unknown>> {
    const user = req.user as { sub: string };
    return this.versionsService.restoreVersion(
      query.siteId,
      slug,
      query.locale || "en",
      versionId,
      user.sub,
    );
  }
}
