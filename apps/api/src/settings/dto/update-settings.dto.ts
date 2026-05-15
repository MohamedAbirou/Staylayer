import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateIf,
} from "class-validator";
import { Transform } from "class-transformer";

// Coerce empty string → undefined so @IsOptional() skips validation for "clear" values
const emptyToUndefined = () =>
  Transform(({ value }) => (value === "" ? undefined : value));

const SUPPORTED_LOCALES = ["en", "es", "fr", "de"];

// Strict but tolerant regex patterns for popular analytics products.
// Empty string is coerced to undefined and skips validation entirely.
const GA_ID_PATTERN = /^(G|UA|AW|DC)-[A-Z0-9-]{4,32}$/;
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,20}$/;
const CLARITY_ID_PATTERN = /^[a-z0-9]{6,20}$/;
const GOOGLE_VERIFY_PATTERN = /^[A-Za-z0-9_-]{20,100}$/;
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
