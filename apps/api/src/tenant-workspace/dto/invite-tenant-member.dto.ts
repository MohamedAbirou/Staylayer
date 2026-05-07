import { TenantMembershipRole } from "@prisma/client";
import { IsEmail, IsEnum } from "class-validator";

export class InviteTenantMemberDto {
  @IsEmail()
  email: string;

  @IsEnum(TenantMembershipRole)
  role: TenantMembershipRole;
}
