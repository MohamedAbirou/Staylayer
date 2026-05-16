import {
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

import { CRAWLER_CATALOG } from "../../crawlers/crawler-catalog";

const VALID_USER_AGENTS = CRAWLER_CATALOG.map((entry) => entry.userAgent);

export class UpdateRobotsSettingsDto {
  /**
   * Free-form extra rules appended after the platform-managed groups.
   * Limited to 8 KB which is well under Google's documented 500 KB cap and
   * keeps the editor responsive.
   */
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  robotsCustomRules?: string;

  /**
   * Map of `User-agent` → `"allow" | "disallow"`. Keys must exist in the
   * platform crawler catalog; anything else is rejected at the service layer.
   */
  @IsOptional()
  robotsAiCrawlerPolicy?: Record<string, "allow" | "disallow">;

  /**
   * Pathnames excluded from sitemap.xml. Each entry must start with `/`.
   * Capped at 200 entries; the service additionally normalizes and dedupes.
   */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sitemapExcludedPaths?: string[];

  @IsOptional()
  @IsBoolean()
  sitemapIncludeImages?: boolean;
}

export class TestRobotsRuleDto {
  @IsString()
  @MaxLength(2048)
  url!: string;

  @IsOptional()
  @IsString()
  @IsIn(VALID_USER_AGENTS, {
    message: `userAgent must be one of: ${VALID_USER_AGENTS.join(", ")}`,
  })
  userAgent?: string;
}
