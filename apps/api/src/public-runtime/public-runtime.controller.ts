import {
  Controller,
  Get,
  Headers,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { CreatePreviewLinkDto } from "./dto/create-preview-link.dto";
import { ResolveHostDto } from "./dto/resolve-host.dto";
import { RuntimePageQueryDto } from "./dto/runtime-page-query.dto";
import { RuntimeRoutesQueryDto } from "./dto/runtime-routes-query.dto";
import { PublicRuntimeService } from "./public-runtime.service";

@Controller()
export class PublicRuntimeController {
  constructor(
    private readonly publicRuntimeService: PublicRuntimeService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  @Get("public/runtime/resolve-host")
  async resolveHost(
    @Headers("x-website-runtime-secret") secret: string,
    @Query() query: ResolveHostDto,
  ) {
    this.publicRuntimeService.assertTrustedWebsite(secret);
    return this.publicRuntimeService.resolveHost(query);
  }

  @Get("public/runtime/page")
  async getPage(
    @Headers("x-website-runtime-secret") secret: string,
    @Query() query: RuntimePageQueryDto,
  ) {
    this.publicRuntimeService.assertTrustedWebsite(secret);
    return this.publicRuntimeService.getPagePayload(query);
  }

  @Get("public/runtime/routes")
  async getRoutes(
    @Headers("x-website-runtime-secret") secret: string,
    @Query() query: RuntimeRoutesQueryDto,
  ) {
    this.publicRuntimeService.assertTrustedWebsite(secret);
    return this.publicRuntimeService.getRoutes(query);
  }

  @Post("sites/:siteId/preview-links")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async createPreviewLink(
    @Param("siteId") siteId: string,
    @Body() body: CreatePreviewLinkDto,
    @Req() req: Request,
  ) {
    const request = req as Request & {
      user?: AuthenticatedRequestUser;
      query: Record<string, unknown>;
      headers: Record<string, string | string[] | undefined>;
    };

    request.query.siteId = siteId;
    const authorizedSiteId =
      await this.workspaceAccessService.ensureSiteAccess(request);

    return this.publicRuntimeService.createPreviewLink({
      siteId: authorizedSiteId,
      actorId: request.user?.sub ?? request.user?.email ?? "unknown",
      requestedHost: body.host,
      requestedPathname: body.pathname,
      expiresInSeconds: body.expiresInSeconds,
    });
  }
}
