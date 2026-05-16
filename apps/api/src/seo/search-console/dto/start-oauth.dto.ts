import { IsOptional, IsString, MaxLength } from "class-validator";

export class StartOAuthDto {
  /** Optional dashboard path to return to after exchange completes. */
  @IsString()
  @IsOptional()
  @MaxLength(512)
  returnTo?: string;
}
