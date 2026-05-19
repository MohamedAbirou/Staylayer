import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformRole } from "@prisma/client";
import { TransactionalEmailService } from "../mail/transactional-email.service";

/**
 * Phase 12 — out-of-band operator notifications.
 *
 * Best-effort delivery of operator-account lifecycle emails (role change,
 * password reset, access revocation, MFA reset). Failures are swallowed
 * and logged so the originating mutation never fails because of a
 * downstream SMTP outage — the database write is the source of truth.
 *
 * If SMTP is not configured (dev / CI), the service no-ops and the audit
 * log + structured log line remain the only record of the action.
 */
@Injectable()
export class OperatorNotificationsService {
  private readonly logger = new Logger(OperatorNotificationsService.name);

  constructor(
    private readonly email: TransactionalEmailService,
    private readonly config: ConfigService,
  ) {}

  async notifyRoleChanged(input: {
    to: string;
    previousRole: PlatformRole;
    nextRole: PlatformRole;
    actorEmail: string;
  }): Promise<void> {
    const subject = `[Staylayer Operator] Your role has changed to ${input.nextRole}`;
    const text = [
      `Hello,`,
      ``,
      `Your operator role has been changed:`,
      `  Previous: ${input.previousRole}`,
      `  New:      ${input.nextRole}`,
      ``,
      `Performed by: ${input.actorEmail}`,
      ``,
      `All of your previously active operator sessions have been revoked. You will need to sign in again at ${this.appUrl()}.`,
      ``,
      `If you did not expect this change, contact a Platform Owner immediately.`,
    ].join("\n");
    await this.safeSend({
      to: input.to,
      subject,
      text,
      html: textToHtml(text),
    });
  }

  async notifyPasswordReset(input: {
    to: string;
    actorEmail: string;
  }): Promise<void> {
    const subject = `[Staylayer Operator] Your password was reset`;
    const text = [
      `Hello,`,
      ``,
      `Your operator console password was reset by ${input.actorEmail}.`,
      `All of your active operator sessions have been revoked.`,
      ``,
      `If you did not request this, contact a Platform Owner immediately.`,
    ].join("\n");
    await this.safeSend({
      to: input.to,
      subject,
      text,
      html: textToHtml(text),
    });
  }

  async notifyAccessRevoked(input: {
    to: string;
    actorEmail: string;
  }): Promise<void> {
    const subject = `[Staylayer Operator] Operator access revoked`;
    const text = [
      `Hello,`,
      ``,
      `Your operator console access has been revoked by ${input.actorEmail}.`,
      `You will no longer be able to sign in to the operator console.`,
      ``,
      `If you believe this is in error, contact a Platform Owner.`,
    ].join("\n");
    await this.safeSend({
      to: input.to,
      subject,
      text,
      html: textToHtml(text),
    });
  }

  async notifyMfaReset(input: {
    to: string;
    actorEmail: string;
  }): Promise<void> {
    const subject = `[Staylayer Operator] Your MFA was reset`;
    const text = [
      `Hello,`,
      ``,
      `Your operator MFA enrollment was reset by ${input.actorEmail}.`,
      `On your next sign-in you will be required to re-enroll a new authenticator app.`,
      ``,
      `If you did not request this, contact a Platform Owner immediately.`,
    ].join("\n");
    await this.safeSend({
      to: input.to,
      subject,
      text,
      html: textToHtml(text),
    });
  }

  private appUrl(): string {
    return (
      this.config.get<string>("OPERATOR_CONSOLE_URL") ??
      this.config.get<string>("APP_URL") ??
      "https://operator.staylayer.com"
    );
  }

  private async safeSend(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    if (!this.email.isConfigured()) {
      this.logger.warn(
        `[operator-notifications] SMTP not configured; skipping "${input.subject}" to ${maskEmail(input.to)}`,
      );
      return;
    }
    try {
      await this.email.send(input);
      this.logger.log(
        `[operator-notifications] sent "${input.subject}" to ${maskEmail(input.to)}`,
      );
    } catch (err) {
      this.logger.warn(
        `[operator-notifications] delivery failed to ${maskEmail(input.to)}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

function textToHtml(text: string): string {
  return `<pre style="font-family:ui-sans-serif,system-ui,sans-serif;white-space:pre-wrap">${text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</pre>`;
}
