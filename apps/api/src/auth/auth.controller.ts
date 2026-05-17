import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { AuthenticatedRequestUser, AuthResponse } from "./auth.types";
import { AuthContextDto } from "./dto/auth-context.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ login: {} })
  @UseGuards(AuthGuard("local"))
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const user = req.user as {
      id: string;
      email: string;
      platformRole: AuthResponse["user"]["platformRole"];
    };
    const result = await this.authService.login(user, loginDto);

    const refreshToken = await this.authService.generateRefreshToken(user.id);
    res.cookie(
      "refresh_token",
      refreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return result;
  }

  @Post("refresh")
  @Throttle({ refresh: {} })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() context: AuthContextDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const rawToken = req.cookies?.["refresh_token"] as string | undefined;

    if (!rawToken) {
      throw new UnauthorizedException({
        code: "TOKEN_EXPIRED",
        message: "Refresh token expired or not found",
      });
    }

    const { newRefreshToken, ...result } =
      await this.authService.refreshAccessToken(rawToken, context);

    res.cookie(
      "refresh_token",
      newRefreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return result;
  }

  @Post("context")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async switchContext(
    @Body() context: AuthContextDto,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    const user = req.user as AuthenticatedRequestUser;
    return this.authService.switchContext(user.sub, context);
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    res.cookie("refresh_token", "", this.authService.getClearCookieOptions());
    return { message: "Logged out successfully" };
  }
}
