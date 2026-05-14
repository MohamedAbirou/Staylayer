import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ResolveHostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  hostname: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pathname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  previewToken?: string;
}
