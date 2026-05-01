import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../users/users.service";

const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000;

interface RefreshTokenPayload {
  sub: string;
  type: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; role: string } | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return null;
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({
        code: "ACCOUNT_LOCKED",
        message: `Account locked. Try again after ${user.lockedUntil.toISOString()}`,
      });
    }

    const isPasswordValid = await this.usersService.verifyPassword(
      user.passwordHash,
      password,
    );

    if (!isPasswordValid) {
      await this.usersService.incrementFailedAttempts(user.id);
      this.logger.warn(`Failed login attempt for user ${user.email}`);
      return null;
    }

    // Reset failed attempts on successful login
    await this.usersService.resetFailedAttempts(user.id);

    return { id: user.id, email: user.email, role: user.role };
  }

  async login(user: { id: string; email: string; role: string }): Promise<{
    accessToken: string;
    user: { id: string; email: string; role: string };
  }> {
    const accessToken = await this.generateAccessToken(user);
    return {
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async generateRefreshToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, type: "refresh" },
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    newRefreshToken: string;
    user: { id: string; email: string; role: string };
  }> {
    let payload: RefreshTokenPayload;
    try {
      payload =
        await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException({
        code: "TOKEN_EXPIRED",
        message: "Refresh token expired or invalid",
      });
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException({
        code: "INVALID_TOKEN",
        message: "Invalid token type",
      });
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({
        code: "USER_NOT_FOUND",
        message: "User not found",
      });
    }

    const accessToken = await this.generateAccessToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      newRefreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  getRefreshTokenCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge: REFRESH_TOKEN_EXPIRY,
    };
  }

  getClearCookieOptions(): {
    httpOnly: boolean;
    secure: boolean;
    sameSite: "strict";
    path: string;
    maxAge: number;
  } {
    return {
      httpOnly: true,
      secure: this.configService.get<string>("NODE_ENV") === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    };
  }

  private async generateAccessToken(user: {
    id: string;
    email: string;
    role: string;
  }): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });
  }
}
