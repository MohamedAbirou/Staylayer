import { IsString, MinLength } from "class-validator";

export class LeaveWorkspaceDto {
  /**
   * The user must type the workspace slug exactly to confirm self-removal.
   */
  @IsString()
  @MinLength(1)
  confirmTenantSlug: string;
}
