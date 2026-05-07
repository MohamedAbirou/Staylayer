import { IsOptional, IsString, MinLength } from "class-validator";

export class TenantScopeQueryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantId?: string;
}

export class SiteScopeQueryDto extends TenantScopeQueryDto {
  @IsString()
  @MinLength(1)
  siteId: string;
}
