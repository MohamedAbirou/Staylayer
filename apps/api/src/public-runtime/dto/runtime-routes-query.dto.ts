import { IsString, MaxLength, MinLength } from "class-validator";

export class RuntimeRoutesQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  hostname: string;
}
