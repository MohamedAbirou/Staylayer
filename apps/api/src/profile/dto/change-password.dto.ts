import { IsString, MinLength, MaxLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(12, { message: "New password must be at least 12 characters" })
  @MaxLength(128)
  newPassword: string;
}
