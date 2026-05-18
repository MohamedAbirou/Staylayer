import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import type { Request } from "express";
import { OperatorJwtAuthGuard } from "../auth/operator/guards/operator-jwt-auth.guard";
import { OperatorAuditInterceptor } from "../auth/operator/audit/operator-audit.interceptor";
import { OperatorResourcesService } from "./operator-resources.service";
import { OperatorSearchQueryDto } from "./dto/operator-search-query.dto";
import {
  OPERATOR_JWT_AUDIENCE,
  type OperatorAuthenticatedRequestUser,
} from "../auth/operator/operator-auth.types";

/**
 * Global search v1. Returns up to `limit` results per category, filtered to
 * the categories the operator is allowed to read. Each per-category query
 * is independent and bounded server-side (limit ≤ 20 enforced by the DTO),
 * so a global search round-trip never executes more than four bounded
 * SELECTs.
 */
@Controller("operator/search")
@UseGuards(OperatorJwtAuthGuard)
@UseInterceptors(OperatorAuditInterceptor)
export class OperatorSearchController {
  constructor(private readonly operatorResources: OperatorResourcesService) {}

  @Get()
  async search(@Req() req: Request, @Query() query: OperatorSearchQueryDto) {
    const user = req.user as OperatorAuthenticatedRequestUser | undefined;
    if (!user || user.aud !== OPERATOR_JWT_AUDIENCE) {
      throw new UnauthorizedException({
        code: "OPERATOR_UNAUTHENTICATED",
        message: "Operator authentication is required",
      });
    }

    return this.operatorResources.globalSearch({
      q: query.q,
      limit: query.limit ?? 10,
      role: user.platformRole,
    });
  }
}
