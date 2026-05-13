import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";

/**
 * NotificationsModule — provides EmailService for transactional email sending.
 *
 * EmailService runs in "log-only" mode if SMTP_* env vars are absent, so this
 * module is safe to import in all environments (dev, test, prod).
 */
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class NotificationsModule {}
