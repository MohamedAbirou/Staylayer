import { IsOptional, IsString, MinLength, ValidateIf } from "class-validator";

export class RestoreSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MinLength(1)
  publicSubdomain?: string | null;
}
