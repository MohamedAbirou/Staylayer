import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import { FormSubmissionStatus } from "@prisma/client";
import { SiteScopeQueryDto } from "../../common/dto/site-scope-query.dto";

export class SiteSubmissionsQueryDto extends SiteScopeQueryDto {
  @IsOptional()
  @IsEnum(FormSubmissionStatus)
  status?: FormSubmissionStatus;

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

export class AdminFormsQueryDto {
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
