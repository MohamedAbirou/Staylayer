import { IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * Parameters for starting a new SEO crawl. Site scoping is handled by
 * `WorkspaceScopeGuard` + `workspaceAccessService.ensureSiteAccess`, so this
 * DTO only carries crawl-shape options.
 */
export class StartCrawlDto {
  /** Maximum URLs the crawler is allowed to fetch. Clamped by plan. */
  @IsInt()
  @Min(1)
  @Max(10_000)
  urlLimit!: number;

  /** Max BFS depth from the start URL. */
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  maxDepth?: number;
}
