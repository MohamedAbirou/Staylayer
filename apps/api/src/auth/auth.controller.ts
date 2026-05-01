import {
  Controller,
  Post,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Body,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ login: {} })
  @UseGuards(AuthGuard("local"))
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() _loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
    user: { id: string; email: string; role: string };
  }> {
    const user = req.user as { id: string; email: string; role: string };
    const result = await this.authService.login(user);

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
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
    user: { id: string; email: string; role: string };
  }> {
    const rawToken = req.cookies?.["refresh_token"] as string | undefined;

    if (!rawToken) {
      throw new UnauthorizedException({
        code: "TOKEN_EXPIRED",
        message: "Refresh token expired or not found",
      });
    }

    const { accessToken, newRefreshToken, user } =
      await this.authService.refreshAccessToken(rawToken);

    res.cookie(
      "refresh_token",
      newRefreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return { accessToken, user };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    res.cookie("refresh_token", "", this.authService.getClearCookieOptions());
    return { message: "Logged out successfully" };
  }
}
