import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Request } from "express";
import { AuthenticatedRequestUser } from "../auth.types";
import { WorkspaceAccessService } from "../workspace-access.service";

@Injectable()
export class WorkspaceScopeGuard implements CanActivate {
  constructor(
    private readonly workspaceAccessService: WorkspaceAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: AuthenticatedRequestUser;
        query: Record<string, unknown>;
        headers: Record<string, string | string[] | undefined>;
      }
    >();

    await this.workspaceAccessService.ensureSiteAccess(request);
    return true;
  }
}
