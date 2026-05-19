import { IsString, Length, MaxLength, MinLength } from "class-validator";

export class OperatorMfaVerifyDto {
  @IsString()
  @MaxLength(2048)
  challengeToken: string;

  /** 6-digit TOTP or 11-char recovery code (5-5 with dash). */
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code: string;
}

export class OperatorMfaEnrollConfirmDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

/**
 * Body for `POST /operator/auth/mfa/recovery-codes/regenerate`. The
 * operator submits a fresh 6-digit TOTP from their authenticator app to
 * prove possession of the second factor before the server issues a new
 * batch of recovery codes (and invalidates the previous batch).
 */
export class OperatorMfaRegenerateRecoveryCodesDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
