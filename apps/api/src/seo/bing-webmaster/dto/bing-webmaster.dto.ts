import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class ConnectBingDto {
  /** The Bing Webmaster API key generated from the Bing Webmaster Tools UI. */
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  apiKey!: string;

  /**
   * The verified site URL in Bing Webmaster (e.g. `https://example.com/`).
   * Must be an absolute http(s) URL.
   */
  @IsString()
  @MaxLength(2048)
  propertyUrl!: string;
}

export class VerifyBingApiKeyDto {
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  apiKey!: string;
}

export class SyncBingDto {
  /** Reserved for future use — Bing currently rolls up trailing windows server-side. */
  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "startDate must be YYYY-MM-DD" })
  startDate?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: "endDate must be YYYY-MM-DD" })
  endDate?: string;
}

export class SubmitBingSitemapDto {
  @IsString()
  @MaxLength(2048)
  sitemapUrl!: string;
}
