import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { FormFieldType, FormType } from "@prisma/client";
import { INQUIRY_INTEGRATION_PROVIDERS } from "../inquiry-integration";

export class FormFieldDraftDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  label: string;

  @IsEnum(FormFieldType)
  type: FormFieldType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  placeholder?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  helpText?: string;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsObject()
  validation?: Record<string, unknown>;

  @IsOptional()
  options?: unknown;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  defaultValue?: string;

  @IsOptional()
  @IsBoolean()
  isPlatformManaged?: boolean;

  @IsOptional()
  @IsObject()
  visibilityRules?: Record<string, unknown>;
}

export class FormRoutingRuleDraftDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageSlug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  locale?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  saveToInbox?: boolean;

  @IsOptional()
  @IsArray()
  emailRecipients?: string[];

  @IsOptional()
  @IsString()
  @IsIn(INQUIRY_INTEGRATION_PROVIDERS)
  integrationProvider?: string;

  @IsOptional()
  @IsObject()
  integrationConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  integrationSecret?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  webhookSecret?: string;

  @IsOptional()
  @IsBoolean()
  sendConfirmationEmail?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  confirmationReplyToFieldKey?: string;
}

export class UpsertFormDefinitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  key: string;

  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name: string;

  @IsEnum(FormType)
  formType: FormType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  assignment?: Record<string, unknown>;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDraftDto)
  fields: FormFieldDraftDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormRoutingRuleDraftDto)
  routingRules?: FormRoutingRuleDraftDto[];
}
