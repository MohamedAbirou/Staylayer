import {
  IsOptional,
  IsString,
  IsIn,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from "class-validator";
import { Transform } from "class-transformer";
import { SiteScopeQueryDto } from "../../common/dto/site-scope-query.dto";
import { SUPPORTED_LOCALES } from "../../common/supported-locales";

export { SiteScopeQueryDto as SiteScopedQueryDto };

export class PageQueryDto extends SiteScopeQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  deleted?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  limit?: number = 50;

  @IsOptional()
  @IsString()
  search?: string;
}

export class PageLocaleQueryDto extends SiteScopeQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string = "en";

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === "true") return true;
    if (value === "false") return false;
    return value;
  })
  @IsBoolean()
  published?: boolean;
}

export class PublishedPagesQueryDto extends SiteScopeQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string;
}

export class VersionQueryDto extends SiteScopeQueryDto {
  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: string = "en";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  limit?: number = 20;
}
