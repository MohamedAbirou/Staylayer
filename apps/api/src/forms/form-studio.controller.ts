import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { TenantMembershipRole } from "@prisma/client";
import { AdminService } from "../admin/admin.service";
import { AuthenticatedRequestUser } from "../auth/auth.types";
import { MembershipRoles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { WorkspaceScopeGuard } from "../auth/guards/workspace-scope.guard";
import { WorkspaceAccessService } from "../auth/workspace-access.service";
import { FormsService } from "./forms.service";
import { FormStudioQueryDto } from "./dto/form-studio-query.dto";
import {
  PreviewFormEmailDto,
  SendTestFormEmailDto,
} from "./dto/preview-form-email.dto";
import { UpdateFormEmailStudioDto } from "./dto/update-form-email-studio.dto";
import { UpdateSiteRoutingDto } from "./dto/update-site-routing.dto";
import { UpsertFormDefinitionDto } from "./dto/upsert-form-definition.dto";

@Controller("forms")
@UseGuards(JwtAuthGuard, RolesGuard, WorkspaceScopeGuard)
export class FormStudioController {
  constructor(
    private readonly formsService: FormsService,
    private readonly workspaceAccessService: WorkspaceAccessService,
    private readonly adminService: AdminService,
  ) {}

  private async ensureAuthenticatedSiteAccess(req: Request): Promise<string> {
    return this.workspaceAccessService.ensureSiteAccess(
      req as Request & {
        user?: AuthenticatedRequestUser;
        query: Record<string, unknown>;
        headers: Record<string, string | string[] | undefined>;
      },
    );
  }

  @Get()
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async list(@Query() _query: FormStudioQueryDto, @Req() req: Request) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.formsService.listDefinitions(siteId);
  }

  @Patch("routing/fallback")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async updateSiteRouting(
    @Query() _query: FormStudioQueryDto,
    @Body() dto: UpdateSiteRoutingDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as AuthenticatedRequestUser | undefined;
    const routingRules = await this.formsService.updateSiteRoutingRules(
      siteId,
      dto.routingRules,
    );

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "form.site_routing_updated",
      targetType: "form_routing_rule",
      metadata: {
        routeCount: routingRules.length,
      },
    });

    return { routingRules };
  }

  @Post()
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async create(
    @Query() _query: FormStudioQueryDto,
    @Body() dto: UpsertFormDefinitionDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const definition = await this.formsService.saveDefinition(
      siteId,
      null,
      dto,
    );
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "form.definition_created",
      targetType: "form_definition",
      targetId: definition.id,
      metadata: {
        formKey: definition.key,
        formType: definition.formType,
      },
    });

    return definition;
  }

  @Put(":id")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async update(
    @Param("id") id: string,
    @Query() _query: FormStudioQueryDto,
    @Body() dto: UpsertFormDefinitionDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const definition = await this.formsService.saveDefinition(siteId, id, dto);
    const user = req.user as AuthenticatedRequestUser | undefined;

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "form.definition_updated",
      targetType: "form_definition",
      targetId: definition.id,
      metadata: {
        formKey: definition.key,
        formType: definition.formType,
      },
    });

    return definition;
  }

  @Post(":id/publish")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async publish(
    @Param("id") id: string,
    @Query() _query: FormStudioQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as AuthenticatedRequestUser | undefined;
    const published = await this.formsService.publishDefinition(
      siteId,
      id,
      user?.sub ?? null,
    );

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "form.definition_published",
      targetType: "form_definition",
      targetId: published.id,
      metadata: {
        activeSchemaVersionId: published.activeSchemaVersion?.id ?? null,
      },
    });

    return published;
  }

  @Get("email")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  async getEmailStudio(
    @Query() _query: FormStudioQueryDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.formsService.getEmailStudio(siteId);
  }

  @Patch("email")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  async updateEmailStudio(
    @Query() _query: FormStudioQueryDto,
    @Body() dto: UpdateFormEmailStudioDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as AuthenticatedRequestUser | undefined;
    const studio = await this.formsService.updateEmailStudio(
      siteId,
      dto,
      user?.sub ?? null,
    );

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "form.email_studio_updated",
      targetType: "form_email_theme",
      targetId: studio.theme.id,
    });

    return studio;
  }

  @Post("email/preview")
  @MembershipRoles(
    TenantMembershipRole.OWNER,
    TenantMembershipRole.ADMIN,
    TenantMembershipRole.EDITOR,
    TenantMembershipRole.BILLING,
  )
  @HttpCode(HttpStatus.OK)
  async previewEmail(
    @Query() _query: FormStudioQueryDto,
    @Body() dto: PreviewFormEmailDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    return this.formsService.previewEmail(siteId, dto);
  }

  @Post("email/test")
  @MembershipRoles(TenantMembershipRole.OWNER, TenantMembershipRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async sendTestEmail(
    @Query() _query: FormStudioQueryDto,
    @Body() dto: SendTestFormEmailDto,
    @Req() req: Request,
  ) {
    const siteId = await this.ensureAuthenticatedSiteAccess(req);
    const user = req.user as AuthenticatedRequestUser | undefined;
    const result = await this.formsService.sendTestEmail(siteId, dto);

    await this.adminService.createAuditLogForSite({
      siteId,
      actorUserId: user?.sub ?? null,
      action: "form.email_test_sent",
      targetType: "form_email_template",
      metadata: {
        templateType: dto.templateType,
        recipientEmail: dto.recipientEmail,
      },
    });

    return result;
  }
}
