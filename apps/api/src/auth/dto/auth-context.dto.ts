import { IsOptional, IsString, MinLength } from "class-validator";

export class AuthContextDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  tenantId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  siteId?: string;
}
