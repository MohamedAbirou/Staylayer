import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { OperatorLoginDto } from "./dto/operator-login.dto";
import { OperatorJwtAuthGuard } from "./guards/operator-jwt-auth.guard";
import { OperatorAuthService } from "./operator-auth.service";
import {
  OPERATOR_REFRESH_COOKIE,
  OperatorAuthResponse,
  OperatorAuthenticatedRequestUser,
  OperatorSessionResponse,
} from "./operator-auth.types";

@Controller("operator/auth")
export class OperatorAuthController {
  constructor(private readonly operatorAuthService: OperatorAuthService) {}

  @Post("login")
  @Throttle({ login: {} })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: OperatorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OperatorAuthResponse> {
    const operator = await this.operatorAuthService.validateOperator(
      dto.email,
      dto.password,
    );

    const { auth, refreshToken } =
      await this.operatorAuthService.issueLoginTokens(operator, {
        userAgent: req.get("user-agent") ?? null,
        ip: req.ip ?? null,
      });

    res.cookie(
      OPERATOR_REFRESH_COOKIE,
      refreshToken,
      this.operatorAuthService.getRefreshCookieOptions(),
    );

    return auth;
  }

  @Post("refresh")
  @Throttle({ refresh: {} })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OperatorAuthResponse> {
    const rawToken = req.cookies?.[OPERATOR_REFRESH_COOKIE] as
      | string
      | undefined;

    if (!rawToken) {
      throw new UnauthorizedException({
        code: "OPERATOR_REFRESH_MISSING",
        message: "Operator refresh token missing",
      });
    }

    const { auth, refreshToken } = await this.operatorAuthService.refresh(
      rawToken,
      {
        userAgent: req.get("user-agent") ?? null,
        ip: req.ip ?? null,
      },
    );

    res.cookie(
      OPERATOR_REFRESH_COOKIE,
      refreshToken,
      this.operatorAuthService.getRefreshCookieOptions(),
    );

    return auth;
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const rawToken = req.cookies?.[OPERATOR_REFRESH_COOKIE] as
      | string
      | undefined;
    // Best-effort server-side revocation; fall through to clearing the
    // cookie even if the token has already expired.
    try {
      await this.operatorAuthService.revokeRefreshToken(rawToken);
    } catch {
      // Swallow — clearing the client cookie is still required.
    }
    res.cookie(
      OPERATOR_REFRESH_COOKIE,
      "",
      this.operatorAuthService.getClearRefreshCookieOptions(),
    );
    return { message: "Operator logout successful" };
  }

  @Get("session")
  @UseGuards(OperatorJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async session(@Req() req: Request): Promise<OperatorSessionResponse> {
    const user = req.user as OperatorAuthenticatedRequestUser;
    return this.operatorAuthService.getSession(user.id);
  }
}
