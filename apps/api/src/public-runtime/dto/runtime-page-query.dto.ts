import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";
import { Transform } from "class-transformer";
import { SUPPORTED_RUNTIME_LOCALES } from "../public-runtime.util";

export class RuntimePageQueryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  hostname: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  pathname: string;

  @IsOptional()
  @IsString()
  @IsIn([...SUPPORTED_RUNTIME_LOCALES])
  locale?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === "1" || value === "true" || value === true) {
      return true;
    }

    if (value === "0" || value === "false" || value === false) {
      return false;
    }

    return value;
  })
  draft?: boolean;
}
