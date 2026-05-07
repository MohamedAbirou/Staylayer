import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreatePageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be in kebab-case format (e.g., "my-page")',
  })
  slug: string;

  @IsString()
  @IsIn(["en", "es", "fr", "de"])
  locale: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @IsObject()
  puckData: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  seoTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  seoDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoKeywords?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  seoOgImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  seoCanonical?: string;

  @IsOptional()
  @IsBoolean()
  seoNoindex?: boolean;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
