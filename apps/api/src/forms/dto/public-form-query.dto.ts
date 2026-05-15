import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { SUPPORTED_LOCALES } from "../../common/supported-locales";

export class PublicFormQueryDto {
  @IsString()
  @MinLength(1)
  siteId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageSlug?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  formKey?: string;
}
