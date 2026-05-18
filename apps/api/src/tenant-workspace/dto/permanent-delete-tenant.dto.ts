import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

/**
 * Payload for the permanent-delete workspace (tenant) danger-zone action. The
 * actor must type the exact workspace slug (compared after trim, case
 * insensitive — matches the `leaveWorkspace` confirmation pattern) and
 * acknowledge each risk flag surfaced by the deletion-impact endpoint.
 */
export class PermanentDeleteTenantDto {
  @IsString()
  @MinLength(1)
  confirmTenantSlug!: string;

  @IsOptional()
  @IsBoolean()
  acknowledgeOtherMembers?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeActiveSites?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeArchivedSites?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeActiveSubscription?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeProviderResources?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeConnectedDomains?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeFormSubmissions?: boolean;

  @IsOptional()
  @IsBoolean()
  acknowledgeIntegrations?: boolean;

  /**
   * When `true`, the runner will ALSO permanently delete the actor's StayLayer
   * user account after the tenant cascade succeeds — but only if the actor has
   * no other workspace memberships at queue time AND at run time. Requires the
   * `accountDeletionPassword` field to be set so we can re-verify the actor
   * before queuing this irreversible action.
   */
  @IsOptional()
  @IsBoolean()
  alsoDeleteMyAccount?: boolean;

  /**
   * Current password of the actor, required when `alsoDeleteMyAccount` is
   * true. Verified synchronously at queue time and then dropped (never
   * persisted on the job row).
   */
  @IsOptional()
  @IsString()
  accountDeletionPassword?: string;
}
