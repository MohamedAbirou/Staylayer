import { IsString, Matches, MaxLength, MinLength } from "class-validator";

/**
 * Rename a page's slug. The page is identified in the URL by its current
 * slug + locale; this DTO carries the *new* slug. The service auto-records
 * a 301 redirect from the old slug to the new slug.
 */
export class RenamePageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'newSlug must be in kebab-case format (e.g., "my-page")',
  })
  newSlug!: string;
}
