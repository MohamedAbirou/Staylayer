import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { CruxFormFactor, PsiAuditStatus, PsiStrategy } from "@prisma/client";

import { OptionalSiteScopeQueryDto } from "../../../common/dto/site-scope-query.dto";

export class RunPsiAuditDto {
  @IsString()
  url!: string;

  @IsOptional()
  @IsEnum(PsiStrategy)
  strategy?: PsiStrategy;

  @IsOptional()
  forceRefresh?: boolean;
}

export class ListPsiAuditsQueryDto extends OptionalSiteScopeQueryDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsEnum(PsiStrategy)
  strategy?: PsiStrategy;

  @IsOptional()
  @IsEnum(PsiAuditStatus)
  status?: PsiAuditStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class FetchCruxRecordDto {
  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsString()
  origin?: string;

  @IsOptional()
  @IsEnum(CruxFormFactor)
  formFactor?: CruxFormFactor;

  @IsOptional()
  forceRefresh?: boolean;
}

export class LatestPsiAuditsQueryDto extends OptionalSiteScopeQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

// Compatibility for class-transformer not running (e.g., when ValidationPipe
// is disabled or input arrives via JSON without metadata). Keeps the typed
// union shape but lets the runtime accept the same string values.
export type PsiStrategyLike = PsiStrategy | "MOBILE" | "DESKTOP";
export const ALLOWED_STRATEGIES: ReadonlyArray<PsiStrategyLike> = [
  "MOBILE",
  "DESKTOP",
];

export class RunPsiAuditBodyValidator {
  @IsString()
  url!: string;

  @IsOptional()
  @IsIn(["MOBILE", "DESKTOP"])
  strategy?: "MOBILE" | "DESKTOP";
}
