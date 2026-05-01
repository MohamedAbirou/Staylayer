import {
  IsString,
  IsOptional,
  IsIn,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class DuplicatePageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'newSlug must be in kebab-case format (e.g., "my-page")',
  })
  newSlug: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  newTitle: string;

  @IsOptional()
  @IsString()
  @IsIn(["en", "es", "fr", "de"])
  newLocale?: string;
}
