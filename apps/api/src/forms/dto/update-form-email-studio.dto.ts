import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { FormEmailTemplateType } from "@prisma/client";

export class FormEmailThemeDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  brandName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  primaryColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  surfaceColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  textColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  typographyFamily?: string;

  @IsOptional()
  @IsObject()
  buttonStyle?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  cardStyle?: Record<string, unknown>;

  @IsOptional()
  headerContent?: unknown;

  @IsOptional()
  footerContent?: unknown;
}

export class FormEmailTemplateDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @IsEnum(FormEmailTemplateType)
  templateType: FormEmailTemplateType;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @MaxLength(200)
  subjectTemplate: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  previewText?: string;

  @IsOptional()
  blocks?: unknown;

  @IsOptional()
  @IsArray()
  fieldOrder?: string[];
}

export class UpdateFormEmailStudioDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => FormEmailThemeDto)
  theme?: FormEmailThemeDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormEmailTemplateDto)
  templates?: FormEmailTemplateDto[];
}
