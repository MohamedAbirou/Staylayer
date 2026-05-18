import { TenantMembershipRole } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UpdateTenantMemberRoleDto {
  @IsEnum(TenantMembershipRole)
  role: TenantMembershipRole;
}
