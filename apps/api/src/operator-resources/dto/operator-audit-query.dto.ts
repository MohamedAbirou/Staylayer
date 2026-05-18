import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";

export type OperatorAuditScope = "all" | "support" | "billing";

export class OperatorAuditQueryDto {
  /**
   * Optional explicit scope. When omitted the controller infers the widest
   * scope the caller has permission to read.
   */
  @IsOptional()
  @IsIn(["all", "support", "billing"])
  scope?: OperatorAuditScope;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  siteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  actorUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  limit?: number;
}
