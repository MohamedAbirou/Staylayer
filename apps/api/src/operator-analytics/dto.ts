import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class AnalyticsRangeDto {
  @IsOptional()
  @IsIn(["7", "30", "90", 7, 30, 90])
  range?: string | number;
}

export class TenantHealthQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxScore?: number;

  @IsOptional()
  @IsIn(["score", "name"])
  sort?: "score" | "name";

  @IsOptional()
  @IsIn(["asc", "desc"])
  direction?: "asc" | "desc";
}
