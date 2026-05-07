import {
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdatePageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title?: string;

  @IsOptional()
  @IsObject()
  puckData?: Record<string, unknown>;

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
