import { Controller, Get, Query } from "@nestjs/common";
import { SiteSettingsQueryDto } from "./dto/site-settings-query.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class PublicSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get("public")
  async getPublic(@Query() query: SiteSettingsQueryDto) {
    return this.settingsService.getPublic(query.siteId);
  }
}
