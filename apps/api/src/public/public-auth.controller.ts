import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { AuthService } from "../auth/auth.service";
import { CustomerAccessService } from "../auth/customer-access.service";
import { AcceptWorkspaceInvitationDto } from "./dto/accept-workspace-invitation.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { RegisterCustomerDto } from "./dto/register-customer.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { PublicRegistrationService } from "./public-registration.service";

@Controller("public/auth")
@UseGuards(ThrottlerGuard)
export class PublicAuthController {
  constructor(
    private readonly publicRegistrationService: PublicRegistrationService,
    private readonly authService: AuthService,
    private readonly customerAccessService: CustomerAccessService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async register(@Body() dto: RegisterCustomerDto) {
    const registration =
      await this.publicRegistrationService.registerCustomer(dto);
    await this.customerAccessService.sendVerificationEmailForUser(
      registration.userId,
    );

    return {
      accepted: true,
      verificationRequired: true,
      email: registration.email,
      redirectTo: `/verify-email?email=${encodeURIComponent(registration.email)}`,
      provisionedPlanKey: registration.provisionedPlanKey,
      acceptedLegalDocuments: registration.acceptedLegalDocuments,
    };
  }

  @Post("resend-verification")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.customerAccessService.resendVerificationEmail(dto.email);
  }

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async verifyEmail(
    @Body() dto: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const verification = await this.customerAccessService.verifyEmailToken(
      dto.token,
    );
    const authResponse = await this.authService.login({
      id: verification.userId,
      email: verification.email,
      platformRole: null,
    });
    const refreshToken = await this.authService.generateRefreshToken(
      verification.userId,
    );

    res.cookie(
      "refresh_token",
      refreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return {
      ...authResponse,
      redirectTo: this.resolveCustomerRedirectPath(authResponse),
    };
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.customerAccessService.requestPasswordReset(dto.email);
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.customerAccessService.resetPassword(dto.token, dto.password);
  }

  @Get("invitations/:token")
  @HttpCode(HttpStatus.OK)
  async getInvitation(@Param("token") token: string) {
    return this.customerAccessService.getWorkspaceInvitationPreview(token);
  }

  @Post("invitations/accept")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async acceptInvitation(
    @Body() dto: AcceptWorkspaceInvitationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const accepted =
      await this.customerAccessService.acceptWorkspaceInvitation(dto);
    const authResponse = await this.authService.login({
      id: accepted.userId,
      email: accepted.email,
      platformRole: null,
    });
    const refreshToken = await this.authService.generateRefreshToken(
      accepted.userId,
    );

    res.cookie(
      "refresh_token",
      refreshToken,
      this.authService.getRefreshTokenCookieOptions(),
    );

    return {
      ...authResponse,
      redirectTo: this.resolveCustomerRedirectPath(authResponse),
    };
  }

  private resolveCustomerRedirectPath(authResponse: {
    activeMembershipRole: string | null;
    activeSite: { id: string } | null;
  }): string {
    if (
      authResponse.activeMembershipRole === "OWNER" ||
      authResponse.activeMembershipRole === "ADMIN"
    ) {
      return authResponse.activeSite ? "/" : "/workspace";
    }

    if (authResponse.activeMembershipRole === "EDITOR") {
      return authResponse.activeSite ? "/pages" : "/";
    }

    if (authResponse.activeMembershipRole === "BILLING") {
      return "/billing";
    }

    return authResponse.activeSite ? "/" : "/workspace";
  }
}
