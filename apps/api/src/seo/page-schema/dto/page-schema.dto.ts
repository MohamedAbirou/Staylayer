import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
} from "class-validator";

export class OverrideLocatorQueryDto {
  @IsString()
  @Length(1, 200)
  slug!: string;

  @IsString()
  @Length(2, 10)
  locale!: string;
}

export class UpsertOverrideDto {
  @IsOptional()
  @IsIn(["merge", "replace"])
  mode?: "merge" | "replace";

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  disabledTypes?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsObject({ each: true })
  customNodes?: Record<string, unknown>[];
}

export class ValidateJsonLdDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsObject({ each: true })
  nodes!: Record<string, unknown>[];
}

export class PreviewOverrideDto extends UpsertOverrideDto {}
