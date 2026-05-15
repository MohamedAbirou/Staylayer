import { Type } from "class-transformer";
import { SiteType } from "@prisma/client";
import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsString,
  MinLength,
  ValidateNested,
} from "class-validator";
import { SUPPORTED_LOCALES } from "../../common/supported-locales";
import { LegalAcceptanceDto } from "./legal-acceptance.dto";

export class RegisterCustomerDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsEmail()
  workEmail: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @MinLength(1)
  companyName: string;

  @IsString()
  @MinLength(1)
  propertyName: string;

  @IsEnum(SiteType)
  hospitalityType: SiteType;

  @IsString()
  @MinLength(2)
  @IsIn([...SUPPORTED_LOCALES])
  primaryLocale: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LegalAcceptanceDto)
  legalAcceptances: LegalAcceptanceDto[];
}
