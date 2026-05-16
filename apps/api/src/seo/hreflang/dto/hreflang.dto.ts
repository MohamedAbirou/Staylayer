import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { HreflangIssueSeverity, HreflangIssueType } from "@prisma/client";

import { OptionalSiteScopeQueryDto } from "../../../common/dto/site-scope-query.dto";

export class ListHreflangIssuesQueryDto extends OptionalSiteScopeQueryDto {
  @IsOptional()
  @IsString()
  scanId?: string;

  @IsOptional()
  @IsEnum(HreflangIssueType)
  type?: HreflangIssueType;

  @IsOptional()
  @IsEnum(HreflangIssueSeverity)
  severity?: HreflangIssueSeverity;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDismissed?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ListHreflangScansQueryDto extends OptionalSiteScopeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class HreflangPairDto {
  @IsString()
  @Length(1, 200)
  slug!: string;

  @IsString()
  @Length(2, 10)
  locale!: string;
}

export class BulkCreateStubsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => HreflangPairDto)
  pairs!: HreflangPairDto[];
}
