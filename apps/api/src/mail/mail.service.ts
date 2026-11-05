import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { isSharedDemoEmail } from '../auth/demo-accounts.js';
import { AppConfig } from '../config/app-config.js';
import { type EmailContent, renderEmail } from './email-layout.js';

/**
 * Sends the API's own emails (invitations, notifications) over SMTP. Locally the SMTP server is
 * Mailpit, so nothing leaves your computer. Passwordless sign-in emails are sent by Supabase Auth.
 */
@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    const { host, port, secure, user, password } = config.mail;
    this.transporter = createTransport({
      host,
      port,
      secure,
      ...(user ? { auth: { user, pass: password ?? '' } } : {}),
    });
  }

  /** Best effort: returns false (and logs) instead of throwing when delivery fails. */
  async send(to: string, subject: string, content: EmailContent): Promise<boolean> {
    // The shared demo accounts use example.com addresses, which never receive mail.
    if (isSharedDemoEmail(to)) return false;
    const { html, text } = renderEmail(content);
    try {
      await this.transporter.sendMail({ from: this.config.mail.from, to, subject, html, text });
      return true;
    } catch (error) {
      this.logger.warn(`Could not send "${subject}": ${(error as Error).message}`);
      return false;
    }
  }

  onModuleDestroy(): void {
    this.transporter.close();
  }
}
