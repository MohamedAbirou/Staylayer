import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsObject,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";
import { SUPPORTED_LOCALES } from "../../common/supported-locales";
import { INQUIRY_INTEGRATION_PROVIDERS } from "../../forms/inquiry-integration";

// Coerce empty string → undefined so @IsOptional() skips validation for "clear" values
const emptyToUndefined = () =>
  Transform(({ value }) => (value === "" ? undefined : value));

// Strict but tolerant regex patterns for popular analytics products.
// Empty string is coerced to undefined and skips validation entirely.
const GA_ID_PATTERN = /^(G|UA|AW|DC)-[A-Z0-9-]{4,32}$/;
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,20}$/;
const CLARITY_ID_PATTERN = /^[a-z0-9]{6,20}$/;
const GOOGLE_VERIFY_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
const SITE_VERIFY_PATTERN = /^[A-Za-z0-9_=-]{6,120}$/;
const TWITTER_HANDLE_PATTERN = /^@?[A-Za-z0-9_]{1,15}$/;

export class UpdateSettingsDto {
  // General
  @IsString()
  @MaxLength(100)
  @IsOptional()
  siteName?: string;

  @emptyToUndefined()
  @IsEmail()
  @IsOptional()
  supportEmail?: string;

  @ValidateIf((_, value) => value !== "")
  @IsEmail()
  @IsOptional()
  defaultInquiryRoutingEmail?: string;

  @IsString()
  @IsIn(INQUIRY_INTEGRATION_PROVIDERS)
  @IsOptional()
  inquiryIntegrationProvider?: string;

  @IsObject()
  @IsOptional()
  inquiryIntegrationConfig?: Record<string, unknown>;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  inquiryIntegrationSecret?: string;

  @ValidateIf((_, value) => value !== "")
  @IsUrl({ require_protocol: true })
  @IsOptional()
  inquiryWebhookUrl?: string;

  @IsString()
  @MaxLength(200)
  @IsOptional()
  inquiryWebhookSecret?: string;

  @IsString()
  @MaxLength(500)
  @ValidateIf((_, value) => value !== "")
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @MaxLength(500)
  @ValidateIf((_, value) => value !== "")
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  faviconUrl?: string;

  // SEO
  @IsString()
  @MaxLength(200)
  @IsOptional()
  seoTitleTemplate?: string;

  @IsString()
  @MaxLength(300)
  @IsOptional()
  seoDefaultDesc?: string;

  @IsString()
  @IsOptional()
  seoOgImage?: string;

  @IsObject()
  @IsOptional()
  seoLocaleDefaults?: Record<
    string,
    { titleTemplate?: string; description?: string; ogImage?: string }
  >;

  @IsBoolean()
  @IsOptional()
  seoIndexingEnabled?: boolean;

  @IsString()
  @MaxLength(100)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(GOOGLE_VERIFY_PATTERN, {
    message:
      "googleSiteVerify must be the meta-tag token (20-100 chars: letters, digits, _, -)",
  })
  @IsOptional()
  googleSiteVerify?: string;

  @IsString()
  @MaxLength(120)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(SITE_VERIFY_PATTERN, {
    message:
      "bingSiteVerify must be the verification token from Bing Webmaster Tools",
  })
  @IsOptional()
  bingSiteVerify?: string;

  @IsString()
  @MaxLength(120)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(SITE_VERIFY_PATTERN, {
    message: "yandexSiteVerify must be the verification token from Yandex",
  })
  @IsOptional()
  yandexSiteVerify?: string;

  @IsString()
  @MaxLength(120)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(SITE_VERIFY_PATTERN, {
    message:
      "pinterestSiteVerify must be the verification token from Pinterest",
  })
  @IsOptional()
  pinterestSiteVerify?: string;

  // Analytics
  @IsString()
  @MaxLength(50)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(GA_ID_PATTERN, {
    message:
      "gaTrackingId must look like G-XXXXXXXX, UA-XXXXXX-X, AW-XXXXX, or DC-XXXXX",
  })
  @IsOptional()
  gaTrackingId?: string;

  @IsString()
  @MaxLength(50)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(GTM_ID_PATTERN, {
    message: "gtmContainerId must look like GTM-XXXXXXX",
  })
  @IsOptional()
  gtmContainerId?: string;

  @IsString()
  @MaxLength(50)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(CLARITY_ID_PATTERN, {
    message:
      "clarityId must be a 6-20 character lowercase alphanumeric project ID",
  })
  @IsOptional()
  clarityId?: string;

  // Social
  @IsString()
  @MaxLength(100)
  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @Matches(TWITTER_HANDLE_PATTERN, {
    message:
      "twitterHandle must be 1-15 characters of letters, digits, or underscores (with or without leading @)",
  })
  @IsOptional()
  twitterHandle?: string;

  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  linkedinUrl?: string;

  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  facebookUrl?: string;

  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  instagramUrl?: string;

  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  youtubeUrl?: string;

  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  tiktokUrl?: string;

  @ValidateIf(
    (_, value) => value !== "" && value !== undefined && value !== null,
  )
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @IsOptional()
  pinterestUrl?: string;

  // Localization
  @IsString()
  @IsIn(SUPPORTED_LOCALES)
  @IsOptional()
  defaultLocale?: string;

  @IsArray()
  @IsString({ each: true })
  @IsIn(SUPPORTED_LOCALES, { each: true })
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsOptional()
  activeLocales?: string[];
}
