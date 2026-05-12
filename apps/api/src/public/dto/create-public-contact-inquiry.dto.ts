import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

const PLAN_INTEREST_VALUES = [
  "free",
  "starter_stay",
  "boutique_growth",
  "portfolio",
  "custom",
] as const;

export class CreatePublicContactInquiryDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @IsOptional()
  @IsIn(PLAN_INTEREST_VALUES)
  planInterest?: (typeof PLAN_INTEREST_VALUES)[number];

  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  website?: string;
}
