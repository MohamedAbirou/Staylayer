import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import { SiteScopeQueryDto } from "../../common/dto/site-scope-query.dto";

export class SiteDomainQueryDto extends SiteScopeQueryDto {}

export class AdminDomainsQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  verificationStatus?: "UNVERIFIED" | "PENDING" | "VERIFIED" | "FAILED";

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  limit?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  page?: number;
}
