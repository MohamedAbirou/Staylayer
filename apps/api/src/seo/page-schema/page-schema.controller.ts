import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";

import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../../auth/guards/workspace-scope.guard";
import { MembershipRoles } from "../../auth/decorators/roles.decorator";
import { WorkspaceAccessService } from "../../auth/workspace-access.service";
import { AuthenticatedRequestUser } from "../../auth/auth.types";

import { PageSchemaService } from "./page-schema.service";
import {
  OverrideLocatorQueryDto,
  PreviewOverrideDto,
  UpsertOverrideDto,
  ValidateJsonLdDto,
} from "./dto/page-schema.dto";

@Controller("seo/page-schema")
export class PageSchemaController {
  constructor(
    private readonly service: PageSchemaService,
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  private async siteFromReq(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & { user: AuthenticatedRequestUser },
    );
  }

  @Get("overrides")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async getOverride(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: OverrideLocatorQueryDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.getOverride(siteId, {
      slug: query.slug,
      locale: query.locale,
    });
  }

  @Put("overrides")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async upsertOverride(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: OverrideLocatorQueryDto,
    @Body() body: UpsertOverrideDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.upsertOverride(
      siteId,
      { slug: query.slug, locale: query.locale },
      body,
    );
  }

  @Delete("overrides")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async clearOverride(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: OverrideLocatorQueryDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.clearOverride(siteId, {
      slug: query.slug,
      locale: query.locale,
    });
  }

  @Post("validate")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async validate(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Body() body: ValidateJsonLdDto,
  ) {
    await this.siteFromReq(req);
    return this.service.validateNodes(body.nodes);
  }

  @Post("preview")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async preview(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: OverrideLocatorQueryDto,
    @Body() body: PreviewOverrideDto,
  ) {
    const siteId = await this.siteFromReq(req);
    const hasOverride =
      body && (body.mode || body.disabledTypes || body.customNodes);
    return this.service.buildPreview(
      siteId,
      { slug: query.slug, locale: query.locale },
      hasOverride ? body : undefined,
    );
  }

  @Post("test")
  @UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
  )
  async testRuntime(
    @Req() req: Request,
    @Query("siteId") _s: string,
    @Query() query: OverrideLocatorQueryDto,
  ) {
    const siteId = await this.siteFromReq(req);
    return this.service.testRuntime(siteId, {
      slug: query.slug,
      locale: query.locale,
    });
  }
}
