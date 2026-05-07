import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Transform } from "class-transformer";
import { SiteScopeQueryDto } from "../../common/dto/site-scope-query.dto";

export class SiteDeploymentQueryDto extends SiteScopeQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }: { value: unknown }) => parseInt(value as string, 10))
  limit?: number = 10;
}
