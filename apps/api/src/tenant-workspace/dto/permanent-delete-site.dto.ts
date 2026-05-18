import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Payload for the permanent-delete danger-zone action. The user must type the
 * exact site name (compared after trim, case-sensitive) and explicitly
 * acknowledge any risk flags surfaced by the deletion-impact endpoint.
 */
export class PermanentDeleteSiteDto {
  @IsString()
  @MinLength(1)
  confirmSiteName!: string;

  @IsOptional()
  @IsBoolean()
  acknowledgeSubmissions?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeProviderResources?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeIntegrations?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgePublishedPages?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeConnectedDomains?: boolean;
}
