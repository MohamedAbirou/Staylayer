import {
  IsEmail,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { FormType } from "@prisma/client";
import { SUPPORTED_LOCALES } from "../../common/supported-locales";

export class CreateSubmissionDto {
  @IsString()
  @MinLength(1)
  siteId: string;

  @IsEnum(FormType)
  formType: FormType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  formKey?: string;

  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @IsOptional()
  @IsString()
  formSchemaVersionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pageSlug?: string;

  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  message?: string;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;

  // Optional free-form extras (check-in/out dates, group size, etc.)
  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;

  // Honeypot — must be absent or empty.
  @IsOptional()
  @IsString()
  _trap?: string;
}
