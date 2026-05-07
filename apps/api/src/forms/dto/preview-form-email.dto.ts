import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { FormEmailTemplateType } from "@prisma/client";

export class PreviewFormEmailDto {
  @IsEnum(FormEmailTemplateType)
  templateType: FormEmailTemplateType;

  @IsOptional()
  @IsString()
  formDefinitionId?: string;

  @IsOptional()
  @IsObject()
  samplePayload?: Record<string, unknown>;
}

export class SendTestFormEmailDto extends PreviewFormEmailDto {
  @IsEmail()
  @MaxLength(320)
  recipientEmail: string;
}
