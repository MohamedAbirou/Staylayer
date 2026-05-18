import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import {
  SupportCaseCategory,
  SupportCaseChannel,
  SupportCasePriority,
  SupportCaseStatus,
  SupportHandoffTarget,
  SupportLinkedResourceType,
} from "@prisma/client";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

const toInt = ({ value }: { value: unknown }) =>
  typeof value === "string" ? parseInt(value, 10) : value;

const lowerTrim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const dedupedTags = ({ value }: { value: unknown }): unknown => {
  if (!Array.isArray(value)) return value;
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().toLowerCase();
    if (!tag) continue;
    if (tag.length > 32) continue;
    if (out.includes(tag)) continue;
    out.push(tag);
  }
  return out;
};

// ── Queue / list query ──────────────────────────────────────────────────

export class ListSupportCasesQueryDto {
  @IsOptional()
  @IsEnum(SupportCaseStatus, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : value !== undefined ? [value] : undefined,
  )
  status?: SupportCaseStatus[];

  @IsOptional()
  @IsEnum(SupportCasePriority, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : value !== undefined ? [value] : undefined,
  )
  priority?: SupportCasePriority[];

  @IsOptional()
  @IsEnum(SupportCaseCategory, { each: true })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : value !== undefined ? [value] : undefined,
  )
  category?: SupportCaseCategory[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedOperatorId?: string;

  /** `true` filters to unassigned cases; `false` filters to assigned ones. */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) =>
    value === "true" || value === true
      ? true
      : value === "false" || value === false
        ? false
        : undefined,
  )
  unassigned?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }: { value: unknown }) =>
    value === "true" || value === true ? true : undefined,
  )
  slaBreached?: boolean;

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
  @MaxLength(32)
  @Transform(lowerTrim)
  tag?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  @Transform(trim)
  q?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(toInt)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(toInt)
  limit?: number;
}

// ── Create ──────────────────────────────────────────────────────────────

export class CreateSupportCaseDto {
  @IsString()
  @MaxLength(64)
  tenantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  siteId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requesterUserId?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  requesterEmail?: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  @Transform(trim)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  initialMessage?: string;

  @IsOptional()
  @IsEnum(SupportCaseChannel)
  channel?: SupportCaseChannel;

  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsOptional()
  @IsEnum(SupportCaseCategory)
  category?: SupportCaseCategory;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @Transform(dedupedTags)
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedOperatorId?: string;

  /** Optional reason persisted to the operator audit log. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ── Update (priority / category / tags) ─────────────────────────────────

export class UpdateSupportCaseDto {
  @IsOptional()
  @IsEnum(SupportCasePriority)
  priority?: SupportCasePriority;

  @IsOptional()
  @IsEnum(SupportCaseCategory)
  category?: SupportCaseCategory;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @Transform(dedupedTags)
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ── Assign ──────────────────────────────────────────────────────────────

export class AssignSupportCaseDto {
  /** `null` unassigns the case. Use an explicit `null` rather than omitting. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assigneeUserId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;
}

// ── Status transitions ──────────────────────────────────────────────────

export class ResolveSupportCaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  closingMessage?: string;
}

export class ReopenSupportCaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;
}

export class CloseSupportCaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;
}

export class SetStatusSupportCaseDto {
  @IsIn(["OPEN", "PENDING_CUSTOMER", "PENDING_INTERNAL"] as const)
  status!: "OPEN" | "PENDING_CUSTOMER" | "PENDING_INTERNAL";

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ── Messages and notes ──────────────────────────────────────────────────

export class AddSupportCaseMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class AddSupportCaseNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ── Linked resources ────────────────────────────────────────────────────

export class LinkSupportCaseResourceDto {
  @IsEnum(SupportLinkedResourceType)
  resourceType!: SupportLinkedResourceType;

  @IsString()
  @Length(1, 128)
  resourceId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

// ── Handoffs ────────────────────────────────────────────────────────────

export class OpenSupportCaseHandoffDto {
  @IsEnum(SupportHandoffTarget)
  target!: SupportHandoffTarget;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;
}

export class CloseSupportCaseHandoffDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  @Transform(trim)
  reason!: string;
}

// `Type` import keeps tsc-strict happy when class-transformer is enabled.
void Type;
