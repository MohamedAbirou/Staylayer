import { IsString, MinLength } from "class-validator";

export class SiteSettingsQueryDto {
  @IsString()
  @MinLength(1)
  siteId: string;
}
