import { IsString, MinLength } from "class-validator";

export class LegalAcceptanceDto {
  @IsString()
  @MinLength(1)
  documentKey: string;

  @IsString()
  @MinLength(1)
  version: string;
}