import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { Transform } from "class-transformer";

// Coerce empty string → undefined so @IsOptional() skips validation for "clear" values
const emptyToUndefined = () =>
  Transform(({ value }) => (value === "" ? undefined : value));

const SUPPORTED_LOCALES = ["en", "es", "fr", "de"];

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

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
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
  @IsOptional()
  googleSiteVerify?: string;

  // Analytics
  @IsString()
  @MaxLength(50)
  @IsOptional()
  gaTrackingId?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  gtmContainerId?: string;

  @IsString()
  @MaxLength(50)
  @IsOptional()
  clarityId?: string;

  // Social
  @IsString()
  @MaxLength(100)
  @IsOptional()
  twitterHandle?: string;

  @IsString()
  @IsOptional()
  linkedinUrl?: string;

  @IsString()
  @IsOptional()
  facebookUrl?: string;

  // Localization
  @IsString()
  @IsIn(SUPPORTED_LOCALES)
  @IsOptional()
  defaultLocale?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  activeLocales?: string[];
}
