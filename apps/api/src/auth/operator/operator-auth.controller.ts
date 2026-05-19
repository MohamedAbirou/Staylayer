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
import {
  OperatorMfaEnrollConfirmDto,
  OperatorMfaRegenerateRecoveryCodesDto,
  OperatorMfaVerifyDto,
} from "./dto/operator-mfa.dto";
import { OperatorJwtAuthGuard } from "./guards/operator-jwt-auth.guard";
import { OperatorAuthService } from "./operator-auth.service";
import {
  OPERATOR_REFRESH_COOKIE,
  OperatorAuthResponse,
  OperatorAuthenticatedRequestUser,
  OperatorMfaChallenge,
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
  ): Promise<OperatorAuthResponse | OperatorMfaChallenge> {
    const operator = await this.operatorAuthService.validateOperator(
      dto.email,
      dto.password,
    );

    // Phase 12 — if MFA is enrolled, do NOT issue access/refresh tokens
    // yet. Hand back a short-lived challenge token; the caller must POST
    // it to /operator/auth/mfa/verify together with a valid TOTP code.
    if (operator.mfaEnrolled) {
      return this.operatorAuthService.issueMfaChallenge(operator.id);
    }

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

  @Post("mfa/verify")
  @Throttle({ login: {} })
  @HttpCode(HttpStatus.OK)
  async mfaVerify(
    @Body() dto: OperatorMfaVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OperatorAuthResponse> {
    const { auth, refreshToken } =
      await this.operatorAuthService.verifyMfaChallenge(
        dto.challengeToken,
        dto.code,
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

  @Post("mfa/enroll/initiate")
  @UseGuards(OperatorJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mfaEnrollInitiate(
    @Req() req: Request,
  ): Promise<{ secret: string; otpauthUri: string }> {
    const user = req.user as OperatorAuthenticatedRequestUser;
    return this.operatorAuthService.initiateMfaEnrollment(user.id);
  }

  @Post("mfa/enroll/confirm")
  @UseGuards(OperatorJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async mfaEnrollConfirm(
    @Body() dto: OperatorMfaEnrollConfirmDto,
    @Req() req: Request,
  ): Promise<{ enrolledAt: string; recoveryCodes: string[] }> {
    const user = req.user as OperatorAuthenticatedRequestUser;
    return this.operatorAuthService.confirmMfaEnrollment(user.id, dto.code);
  }

  /**
   * Self-service: rotate the operator's recovery codes. Requires a fresh
   * TOTP code from the authenticator app. Rate-limited under the same
   * `login` throttle bucket as MFA verification so we do not give an
   * attacker free guesses against the second factor.
   */
  @Post("mfa/recovery-codes/regenerate")
  @UseGuards(OperatorJwtAuthGuard)
  @Throttle({ login: {} })
  @HttpCode(HttpStatus.OK)
  async mfaRegenerateRecoveryCodes(
    @Body() dto: OperatorMfaRegenerateRecoveryCodesDto,
    @Req() req: Request,
  ): Promise<{ recoveryCodes: string[] }> {
    const user = req.user as OperatorAuthenticatedRequestUser;
    return this.operatorAuthService.regenerateRecoveryCodes(user.id, dto.code);
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
