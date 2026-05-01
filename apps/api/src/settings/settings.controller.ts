import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Query,
} from "@nestjs/common";
import { Request } from "express";
import { SettingsService } from "./settings.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { SiteSettingsQueryDto } from "./dto/site-settings-query.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "@prisma/client";

@Controller("settings")
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@Query() query: SiteSettingsQueryDto) {
    return this.settingsService.get(query.siteId);
  }

  @Patch()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(
    @Query() query: SiteSettingsQueryDto,
    @Body() dto: UpdateSettingsDto,
    @Req() req: Request,
  ) {
    const user = req.user as { email?: string };
    return this.settingsService.update(query.siteId, dto, user?.email);
  }
}
