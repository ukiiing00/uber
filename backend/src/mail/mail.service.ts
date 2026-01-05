import { Inject, Injectable } from '@nestjs/common';
import { CONFIG_OPTIONS } from 'src/common/common.contants';
import type { EmailVar, MailModuleOptions } from './mail.interfaces';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class MailService {
  constructor(
    @Inject(CONFIG_OPTIONS) private readonly options: MailModuleOptions,
  ) {}

  async sendEmail(subject: string, template: string, emailVars: EmailVar[]) {
    const form = new FormData();
    form.append('from', `Mailgun Sandbox <postmaster@${this.options.domain}>`);
    form.append('to', `${this.options.fromEmail}`);
    form.append('subject', subject);
    form.append('template', template);
    emailVars.forEach((eVar) => form.append(`v:${eVar.key}`, eVar.value));
    try {
      await axios.post(
        `https://api.mailgun.net/v3/${this.options.domain}/messages`,
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Basic ${Buffer.from(`api:${this.options.apiKey}`).toString('base64')}`,
          },
        },
      );
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  sendVerificationEmail(email: string, code: string) {
    return this.sendEmail('Verify Your Email', 'verify-email', [
      { key: 'code', value: code },
      { key: 'username', value: email },
    ]);
  }
}
