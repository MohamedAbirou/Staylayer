import { TenantMembershipRole } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";

export class CreateTenantMemberDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @IsEnum(TenantMembershipRole)
  role: TenantMembershipRole;
}
