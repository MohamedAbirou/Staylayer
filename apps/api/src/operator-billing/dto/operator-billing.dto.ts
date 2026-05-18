import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { BILLING_PLANS } from "../../billing/billing-plans";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const toInt = ({ value }: { value: unknown }) =>
  typeof value === "string" ? parseInt(value, 10) : value;

const toBoolean = ({ value }: { value: unknown }) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const BILLING_PLAN_KEYS = Object.keys(BILLING_PLANS);

// ── Reason wrapper (sensitive routes require this) ─────────────────────
//
// Operator audit interceptor independently rejects requests without a
// `reason`, but mutation DTOs still declare it so OpenAPI / generated
// clients reflect the contract.

export class OperatorBillingReasonDto {
  @IsString()
  @Transform(trim)
  @MinLength(8)
  @MaxLength(2000)
  reason!: string;
}

// ── List / filter queries ──────────────────────────────────────────────

export class ListBillingAccountsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Transform(trim)
  q?: string;

  @IsOptional()
  @IsIn([
    "active",
    "trialing",
    "past_due",
    "canceled",
    "incomplete",
    "inactive",
  ])
  status?:
    | "active"
    | "trialing"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "inactive";

  @IsOptional()
  @IsString()
  @MaxLength(64)
  @IsIn(BILLING_PLAN_KEYS)
  planKey?: string;

  /** Filter to tenants whose Stripe state has drifted from the local cache. */
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  mismatch?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListWebhookEventsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(trim)
  eventType?: string;

  /** Filter to events that failed processing. */
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  failed?: boolean;

  /** Filter to events that were never processed (no processedAt). */
  @IsOptional()
  @IsBoolean()
  @Transform(toBoolean)
  unprocessed?: boolean;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ListBillingActionRequestsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantId?: string;

  @IsOptional()
  @IsIn([
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "EXECUTED",
    "FAILED",
    "CANCELED",
  ])
  status?:
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "REJECTED"
    | "EXECUTED"
    | "FAILED"
    | "CANCELED";

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  @Max(100)
  limit?: number;
}

// ── Mutations ──────────────────────────────────────────────────────────

export class ChangePlanDto extends OperatorBillingReasonDto {
  @IsString()
  @IsIn(BILLING_PLAN_KEYS)
  targetPlanKey!: string;
}

export class ExtendGracePeriodDto extends OperatorBillingReasonDto {
  @IsISO8601()
  until!: string;
}

export class RefundInvoiceDto extends OperatorBillingReasonDto {
  /** Refund amount in the invoice currency's smallest unit. Omit for a full refund. */
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  amount?: number;
}

export class IssueCreditDto extends OperatorBillingReasonDto {
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  amount!: number;

  @IsString()
  @MaxLength(8)
  currency!: string;
}

export class CreateBillingNoteDto {
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(4000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class UpdateBillingNoteDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(2)
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export class CreateEntitlementOverrideDto extends OperatorBillingReasonDto {
  @IsString()
  @MaxLength(64)
  @Transform(trim)
  limitKey!: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  intValue?: number | null;

  @IsOptional()
  @IsObject()
  jsonValue?: Record<string, unknown> | null;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class RevokeEntitlementOverrideDto extends OperatorBillingReasonDto {}

export class ApproveActionRequestDto extends OperatorBillingReasonDto {}

export class RejectActionRequestDto extends OperatorBillingReasonDto {}

export class ReplayWebhookDto extends OperatorBillingReasonDto {}

export class CancelAtPeriodEndDto extends OperatorBillingReasonDto {}

export class ReactivateSubscriptionDto extends OperatorBillingReasonDto {}

export class CancelPendingPlanChangeDto extends OperatorBillingReasonDto {}

export class SyncFromStripeDto extends OperatorBillingReasonDto {}

// ── Shared array helpers ───────────────────────────────────────────────

export class ListBillingInvoicesQueryDto {
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Transform(toInt)
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  status?: string[];
}
