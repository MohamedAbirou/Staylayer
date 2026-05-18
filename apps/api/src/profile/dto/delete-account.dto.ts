import { IsString, MinLength } from "class-validator";

export class DeleteAccountDto {
  /**
   * Must equal the current user's email address (case-insensitive).
   */
  @IsString()
  @MinLength(1)
  confirmEmail: string;

  /**
   * Current password — re-authenticated immediately before deletion.
   */
  @IsString()
  @MinLength(1)
  currentPassword: string;
}
