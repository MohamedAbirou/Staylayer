import { Transform } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { SiteScopeQueryDto } from "../../common/dto/site-scope-query.dto";
import { SUPPORTED_LOCALES } from "../../common/supported-locales";

const normalizeLocaleValue = () =>
  Transform(({ value }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  );

const coerceBoolean = () =>
  Transform(({ value }) => {
    if (value === true || value === "true" || value === 1 || value === "1") {
      return true;
    }

    if (value === false || value === "false" || value === 0 || value === "0") {
      return false;
    }

    return value;
  });

export class CreateTranslationJobDto {
  @normalizeLocaleValue()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  sourceLocale: string;

  @normalizeLocaleValue()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  targetLocale: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  pageIds?: string[];

  @IsOptional()
  @coerceBoolean()
  @IsBoolean()
  publishedOnly?: boolean;

  @IsOptional()
  @coerceBoolean()
  @IsBoolean()
  overwrite?: boolean;

  @IsOptional()
  @coerceBoolean()
  @IsBoolean()
  autoPublish?: boolean;
}

export class TranslationGlossaryPreviewQueryDto extends SiteScopeQueryDto {
  @normalizeLocaleValue()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  sourceLocale: string;

  @normalizeLocaleValue()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  targetLocale: string;
}

export class AddTranslationGlossaryTermDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  sourceTerm: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  targetTerm: string;

  @normalizeLocaleValue()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  sourceLocale: string;

  @normalizeLocaleValue()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  targetLocale: string;

  @IsOptional()
  @coerceBoolean()
  @IsBoolean()
  caseSensitive?: boolean;
}
