import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";
import { TenantStatus } from "@prisma/client";

const TENANT_STATUS_VALUES = Object.values(TenantStatus) as string[];

/**
 * Query parameters for the operator tenant list. All filters are optional;
 * pagination is bounded server-side (limit ≤ 100) so the operator surface
 * cannot trigger unbounded scans even if the client sends a higher number.
 */
export class OperatorTenantsQueryDto {
  @IsOptional()
  @IsIn(TENANT_STATUS_VALUES, {
    message: `status must be one of: ${TENANT_STATUS_VALUES.join(", ")}`,
  })
  status?: TenantStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  q?: string;

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

  /**
   * Optional flag — when "true", the response includes the most recent
   * subscription snapshot per tenant. Off by default to keep the list
   * endpoint cheap.
   */
  @IsOptional()
  @IsBooleanString()
  includeCommercial?: string;
}
