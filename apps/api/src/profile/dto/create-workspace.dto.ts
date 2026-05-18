import { IsOptional, IsString, MinLength } from "class-validator";

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  slug?: string;
}
