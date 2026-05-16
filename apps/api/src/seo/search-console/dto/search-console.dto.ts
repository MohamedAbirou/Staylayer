import { IsOptional, IsString, Matches, MaxLength } from "class-validator";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class SyncSearchConsoleDto {
  @IsString()
  @Matches(ISO_DATE, { message: "startDate must be YYYY-MM-DD" })
  @IsOptional()
  startDate?: string;

  @IsString()
  @Matches(ISO_DATE, { message: "endDate must be YYYY-MM-DD" })
  @IsOptional()
  endDate?: string;
}

export class SubmitSitemapDto {
  @IsString()
  @MaxLength(2048)
  sitemapUrl!: string;
}

export class InspectUrlDto {
  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsString()
  @IsOptional()
  @MaxLength(16)
  languageCode?: string;
}
