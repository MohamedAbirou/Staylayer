import { TenantMembershipRole } from "@prisma/client";
import { Equals, IsEnum, IsIn } from "class-validator";

const DEMOTABLE_ROLES = [
  TenantMembershipRole.ADMIN,
  TenantMembershipRole.EDITOR,
  TenantMembershipRole.BILLING,
] as const;

export class TransferTenantOwnershipDto {
  @IsEnum(TenantMembershipRole)
  @IsIn(DEMOTABLE_ROLES as unknown as TenantMembershipRole[])
  demoteSelfTo: TenantMembershipRole;

  @Equals(true, {
    message: "You must explicitly confirm the ownership transfer.",
  })
  confirm: true;
}
