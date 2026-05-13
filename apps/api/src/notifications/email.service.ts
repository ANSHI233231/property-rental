import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

/** IST offset in minutes: UTC + 5:30 */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Convert paise (BigInt) to a formatted INR string: e.g. 1800000n → "₹18,000.00" */
function paiseToINR(paise: bigint): string {
  const rupees = Number(paise) / 100;
  return `₹${rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Format a Date as DD/MM/YYYY in IST */
function formatDateIST(d: Date): string {
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const dd = String(istDate.getUTCDate()).padStart(2, "0");
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = istDate.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
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
   * @param to             - Array of recipient email addresses.
   * @param unitNumber     - Human-readable unit identifier (e.g. "3B").
   * @param newRentPaise   - New monthly rent in paise.
   * @param effectiveDate  - Date the rent change takes effect.
   * @param type           - "scheduled" | "modified" | "cancelled"
   */
  async sendRentChangeNotice(
    to: string[],
    unitNumber: string,
    newRentPaise: bigint,
    effectiveDate: Date,
    type: RentChangeNoticeType,
  ): Promise<void> {
    if (to.length === 0) return;

    const subject = this.buildSubject(type, unitNumber);
    const body = this.buildBody(type, unitNumber, newRentPaise, effectiveDate);

    if (this.logOnly || !this.transporter) {
      this.logger.log(
        `[LOG-ONLY] Would send email:\n` +
          `  To: ${to.join(", ")}\n` +
          `  Subject: ${subject}\n` +
          `  Body:\n${body}`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.smtpFrom,
        to: to.join(", "),
        subject,
        text: body,
      });
      this.logger.log(`Email sent (${type}): unit=${unitNumber} to=${to.join(",")}`);
    } catch (err) {
      // Never propagate — email failures must not break the underlying mutation.
      this.logger.error(
        `Email send failure (${type}): unit=${unitNumber} error=${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildSubject(type: RentChangeNoticeType, unitNumber: string): string {
    switch (type) {
      case "scheduled":
        return `GharSetu: Upcoming Rent Change for Unit ${unitNumber}`;
      case "modified":
        return `GharSetu: Rent Change Updated for Unit ${unitNumber}`;
      case "cancelled":
        return `GharSetu: Scheduled Rent Change Cancelled for Unit ${unitNumber}`;
    }
  }

  private buildBody(
    type: RentChangeNoticeType,
    unitNumber: string,
    newRentPaise: bigint,
    effectiveDate: Date,
  ): string {
    const rentStr = paiseToINR(newRentPaise);
    const dateStr = formatDateIST(effectiveDate);

    switch (type) {
      case "scheduled":
        return (
          `Dear Tenant,\n\n` +
          `Your property manager has scheduled a rent change for Unit ${unitNumber}.\n\n` +
          `New Monthly Rent: ${rentStr}\n` +
          `Effective Date:   ${dateStr} (IST)\n\n` +
          `If you have any questions, please contact your property manager.\n\n` +
          `— GharSetu`
        );
      case "modified":
        return (
          `Dear Tenant,\n\n` +
          `The scheduled rent change for Unit ${unitNumber} has been updated.\n\n` +
          `New Monthly Rent: ${rentStr}\n` +
          `Effective Date:   ${dateStr} (IST)\n\n` +
          `If you have any questions, please contact your property manager.\n\n` +
          `— GharSetu`
        );
      case "cancelled":
        return (
          `Dear Tenant,\n\n` +
          `The previously scheduled rent change for Unit ${unitNumber} has been cancelled.\n\n` +
          `Your current rent will remain unchanged.\n\n` +
          `If you have any questions, please contact your property manager.\n\n` +
          `— GharSetu`
        );
    }
  }
}
