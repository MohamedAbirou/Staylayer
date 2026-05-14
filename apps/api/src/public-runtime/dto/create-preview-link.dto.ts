import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreatePreviewLinkDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  host?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  pathname?: string;

  @IsOptional()
  @IsInt()
  @Min(300)
  @Max(900)
  expiresInSeconds?: number;
}
