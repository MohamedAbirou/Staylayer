import { IsString, MaxLength } from "class-validator";

export class CompleteOAuthDto {
  @IsString()
  @MaxLength(4096)
  code!: string;

  @IsString()
  @MaxLength(4096)
  state!: string;

  /**
   * Search Console property URL to bind this connection to (e.g.
   * "https://example.com/" or "sc-domain:example.com"). Must be a property
   * the authenticated Google account has access to.
   */
  @IsString()
  @MaxLength(512)
  propertyUrl!: string;
}
