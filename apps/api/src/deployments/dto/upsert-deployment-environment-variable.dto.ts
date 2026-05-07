import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpsertDeploymentEnvironmentVariableDto {
  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,63}$/, {
    message:
      "key must start with a letter and contain only uppercase letters, numbers, or underscores",
  })
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  value!: string;

  @IsIn(["plain", "encrypted"])
  type!: "plain" | "encrypted";

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
