import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/** IST offset in minutes: UTC + 5:30 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Convert paise (BigInt) to a whole-rupee INR string: e.g. 1800000n → "₹18,000" */
function paiseToINR(paise: bigint): string {
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

/** Format a Date as DD/MM/YYYY in IST */
function formatDateIST(d: Date): string {
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const dd = String(istDate.getUTCDate()).padStart(2, "0");
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = istDate.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Format a Date as DD MMM YYYY in IST: e.g. "22 Jul 2026" */
function formatDateLongIST(d: Date): string {
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(istDate.getUTCDate()).padStart(2, "0");
  const mmm = months[istDate.getUTCMonth()];
  const yyyy = istDate.getUTCFullYear();
  return `${dd} ${mmm} ${yyyy}`;
}

export type RentChangeNoticeType = "scheduled" | "modified" | "cancelled";

/**
 * EmailService — Nodemailer-backed transactional email.
 *
 * In "log-only" mode (SMTP vars missing or invalid) all send calls are no-ops
 * that log the would-be message. This prevents dev/test environments without
 * real SMTP from crashing.
 *
 * Required env vars (all must be present to enable SMTP):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private logOnly = false;
  private smtpFrom = "";

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>("SMTP_HOST");
    const portStr = this.config.get<string>("SMTP_PORT");
    const user = this.config.get<string>("SMTP_USER");
    const pass = this.config.get<string>("SMTP_PASS");
    const from = this.config.get<string>("SMTP_FROM");

    if (!host || !portStr || !user || !pass || !from) {
      this.logOnly = true;
      this.logger.warn(
        "EmailService: one or more SMTP_* env vars are missing " +
          "(SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM). " +
          "Running in log-only mode — emails will be logged but NOT sent.",
      );
      return;
    }

    const port = parseInt(portStr, 10);
    this.smtpFrom = from;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    this.logger.log(`EmailService: SMTP configured → ${host}:${port} from=${from}`);
  }

  /**
   * Send a rent-change notice to active tenants on a unit.
   *
   * One email is sent per recipient so the body can be personalised with the
   * tenant's name. Subjects and bodies follow the product spec — see
   * buildSubject/buildBody below for exact wording.
   *
   * @param recipients      - Active tenants on the unit's lease (name + email).
   * @param unitNumber      - Human-readable unit identifier (e.g. "3B").
   * @param propertyName    - Property the unit belongs to.
   * @param currentRentPaise - The rent the tenant is paying right now (paise).
   * @param newRentPaise    - The rent that will apply from `effectiveDate` (paise).
   * @param effectiveDate   - Date the rent change takes effect.
   * @param type            - "scheduled" | "modified" | "cancelled"
   */
  async sendRentChangeNotice(
    recipients: { name: string; email: string }[],
    unitNumber: string,
    propertyName: string,
    currentRentPaise: bigint,
    newRentPaise: bigint,
    effectiveDate: Date,
    type: RentChangeNoticeType,
  ): Promise<void> {
    if (recipients.length === 0) return;

    const subject = this.buildSubject(type, unitNumber, propertyName);

    for (const r of recipients) {
      const body = this.buildBody(
        type,
        r.name,
        unitNumber,
        currentRentPaise,
        newRentPaise,
        effectiveDate,
      );

      if (this.logOnly || !this.transporter) {
        this.logger.log(
          `[LOG-ONLY] Would send email:\n` +
            `  To: ${r.email}\n` +
            `  Subject: ${subject}\n` +
            `  Body:\n${body}`,
        );
        continue;
      }

      try {
        await this.transporter.sendMail({
          from: this.smtpFrom,
          to: r.email,
          subject,
          text: body,
        });
        this.logger.log(`Email sent (${type}): unit=${unitNumber} to=${r.email}`);
      } catch (err) {
        // Never propagate — email failures must not break the underlying mutation.
        this.logger.error(
          `Email send failure (${type}): unit=${unitNumber} to=${r.email} error=${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Send a password-reset email to a single user. The link in the body is a
   * fully-qualified URL composed by the caller (auth.service.ts) using the
   * FRONTEND_BASE_URL config. The token inside that URL is single-use and
   * expires in 30 minutes — wording matches that contract.
   *
   * Log-only when SMTP env vars are missing/placeholder.
   */
  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetUrl: string,
  ): Promise<void> {
    if (!to) return;

    const subject = `Reset your GharSetu password`;
    const body =
      `Dear ${name},\n\n` +
      `We received a request to reset your password.\n\n` +
      `Click the link below to set a new password:\n` +
      `${resetUrl}\n\n` +
      `This link is valid for 30 minutes and can only be used once.\n\n` +
      `If you did not request a password reset, ignore this email.\n` +
      `Your password will not change.\n\n` +
      `GharSetu Property Management`;

    if (this.logOnly || !this.transporter) {
      this.logger.log(
        `[LOG-ONLY] Would send email:\n` +
          `  To: ${to}\n` +
          `  Subject: ${subject}\n` +
          `  Body:\n${body}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.smtpFrom,
        to,
        subject,
        text: body,
      });
      this.logger.log(`Password reset email sent: to=${to}`);
    } catch (err) {
      // Never propagate — email failures must not break the underlying flow.
      this.logger.error(
        `Password reset email failure: to=${to} error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Notify admins that a user changed their password.
   *
   * Admins receive only the fact-of-change — never the new password. Sent
   * fire-and-forget after the password update commits.
   */
  async sendPasswordChangeNoticeToAdmins(
    adminEmails: string[],
    userName: string,
    userEmail: string,
    changedAt: Date,
  ): Promise<void> {
    if (adminEmails.length === 0) return;

    const subject = `GharSetu: Password Changed — ${userName} (${userEmail})`;
    const body =
      `User ${userName} (${userEmail}) changed their password on ${formatDateIST(changedAt)} (IST).\n\n` +
      `This is an automated security notification. No action is required unless this change is unexpected — ` +
      `in which case, suspend the account immediately.\n\n— GharSetu`;

    if (this.logOnly || !this.transporter) {
      this.logger.log(
        `[LOG-ONLY] Would send email:\n` +
          `  To: ${adminEmails.join(", ")}\n` +
          `  Subject: ${subject}\n` +
          `  Body:\n${body}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.smtpFrom,
        to: adminEmails.join(", "),
        subject,
        text: body,
      });
      this.logger.log(`Password-change notice sent: user=${userEmail} adminsNotified=${adminEmails.length}`);
    } catch (err) {
      this.logger.error(
        `Password-change notice failure: user=${userEmail} error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildSubject(
    type: RentChangeNoticeType,
    unitNumber: string,
    propertyName: string,
  ): string {
    switch (type) {
      case "scheduled":
        return `Rent Change Notice — Unit ${unitNumber}, ${propertyName}`;
      case "modified":
        return `Rent Change Notice Updated — Unit ${unitNumber}, ${propertyName}`;
      case "cancelled":
        return `Rent Change Cancelled — Unit ${unitNumber}, ${propertyName}`;
    }
  }

  private buildBody(
    type: RentChangeNoticeType,
    tenantName: string,
    unitNumber: string,
    currentRentPaise: bigint,
    newRentPaise: bigint,
    effectiveDate: Date,
  ): string {
    const currentRentStr = paiseToINR(currentRentPaise);
    const newRentStr = paiseToINR(newRentPaise);
    const dateStr = formatDateLongIST(effectiveDate);

    switch (type) {
      case "scheduled":
        return (
          `Dear ${tenantName},\n\n` +
          `This is to inform you that your rent will change effective ${dateStr}.\n\n` +
          `Current Rent: ${currentRentStr}\n` +
          `New Rent: ${newRentStr}\n` +
          `Effective Date: ${dateStr}\n\n` +
          `This notice has been issued 60+ days in advance as required.\n\n` +
          `For any queries, contact your Property Manager.\n\n` +
          `GharSetu Property Management`
        );
      case "modified":
        return (
          `Dear ${tenantName},\n\n` +
          `This is to inform you that your rent will change effective ${dateStr}.\n\n` +
          `Current Rent: ${currentRentStr}\n` +
          `New Rent: ${newRentStr}\n` +
          `Effective Date: ${dateStr}\n\n` +
          `Note: A previously scheduled rent change has been updated with the details above.\n\n` +
          `This notice has been issued 60+ days in advance as required.\n\n` +
          `For any queries, contact your Property Manager.\n\n` +
          `GharSetu Property Management`
        );
      case "cancelled":
        return (
          `Dear ${tenantName},\n\n` +
          `The previously scheduled rent change for your unit ${unitNumber} has been cancelled.\n` +
          `Your current rent of ${currentRentStr} will continue unchanged.\n\n` +
          `GharSetu Property Management`
        );
    }
  }
}
