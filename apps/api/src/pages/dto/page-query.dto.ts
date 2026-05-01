import {
  IsOptional,
  IsString,
  IsIn,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";

export class SiteScopedQueryDto {
  @IsString()
  @MinLength(1)
  siteId: string;
}

export class PageQueryDto extends SiteScopedQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(["en", "es", "fr", "de"])
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

export class PageLocaleQueryDto extends SiteScopedQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(["en", "es", "fr", "de"])
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

export class VersionQueryDto extends SiteScopedQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(["en", "es", "fr", "de"])
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
