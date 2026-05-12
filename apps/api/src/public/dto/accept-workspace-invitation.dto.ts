import { IsOptional, IsString, MinLength } from "class-validator";

export class AcceptWorkspaceInvitationDto {
  @IsString()
  @MinLength(20)
  token: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsString()
  @MinLength(8)
  password: string;
}
