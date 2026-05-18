import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
} from "class-validator";
import { PlatformRole } from "@prisma/client";

const REASON_MIN = 8;
const REASON_MAX = 500;

/**
 * Shared reason field for sensitive operator-user mutations. The audit
 * interceptor reads `request.body.reason` and rejects the call when the
 * decorator's `sensitive: true` flag is set and the reason is empty —
 * keeping a 8-char floor here gives validators a useful first line of
 * defense before the interceptor runs.
 */
export class OperatorUserReasonDto {
  @IsString()
  @Length(REASON_MIN, REASON_MAX, {
    message: `Reason must be between ${REASON_MIN} and ${REASON_MAX} characters`,
  })
  reason!: string;
}

/**
 * Password policy mirrors `MinLength(8)` already enforced on customer
 * accounts (`CreateUserDto`) and adds an explicit upper bound so an
 * accidentally pasted blob cannot DoS argon2 hashing.
 */
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

export class OperatorUserCreateDto extends OperatorUserReasonDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN, {
    message: `Operator password must be at least ${PASSWORD_MIN} characters`,
  })
  @Matches(/[A-Z]/, {
    message: "Operator password must include an uppercase letter",
  })
  @Matches(/[a-z]/, {
    message: "Operator password must include a lowercase letter",
  })
  @Matches(/[0-9]/, { message: "Operator password must include a digit" })
  @Matches(/[^A-Za-z0-9]/, {
    message: "Operator password must include a symbol",
  })
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password!: string;

  @IsEnum(PlatformRole)
  platformRole!: PlatformRole;
}

export class OperatorUserUpdateDto extends OperatorUserReasonDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(PlatformRole)
  platformRole?: PlatformRole;
}

export class OperatorUserPasswordResetDto extends OperatorUserReasonDto {
  @IsString()
  @MinLength(PASSWORD_MIN)
  @Matches(/[A-Z]/, {
    message: "Operator password must include an uppercase letter",
  })
  @Matches(/[a-z]/, {
    message: "Operator password must include a lowercase letter",
  })
  @Matches(/[0-9]/, { message: "Operator password must include a digit" })
  @Matches(/[^A-Za-z0-9]/, {
    message: "Operator password must include a symbol",
  })
  @Length(PASSWORD_MIN, PASSWORD_MAX)
  password!: string;
}

export class OperatorUserRevokeDto extends OperatorUserReasonDto {}

export class OperatorUsersListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  q?: string;

  @IsOptional()
  @IsEnum(PlatformRole)
  platformRole?: PlatformRole;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lockedOnly?: boolean;
}
