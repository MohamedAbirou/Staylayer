import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateSettingsDto } from "./dto/update-settings.dto";

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(siteId: string) {
    return this.prisma.siteSettings.upsert({
      where: { siteId },
      create: { siteId },
      update: {},
    });
  }

  async update(siteId: string, dto: UpdateSettingsDto, updatedBy?: string) {
    return this.prisma.siteSettings.upsert({
      where: { siteId },
      create: { siteId, ...dto, updatedBy },
      update: { ...dto, updatedBy },
    });
  }
}
