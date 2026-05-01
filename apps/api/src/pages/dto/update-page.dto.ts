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
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsString()
  seoKeywords?: string;

  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
