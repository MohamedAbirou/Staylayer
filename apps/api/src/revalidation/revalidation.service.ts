import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const SUPPORTED_LOCALES = ['en', 'es', 'fr', 'de'];

@Injectable()
export class RevalidationService {
  private readonly logger = new Logger(RevalidationService.name);
  private readonly revalidationUrl: string | undefined;
  private readonly revalidateSecret: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.revalidationUrl = this.configService.get<string>('REVALIDATION_URL');
    this.revalidateSecret = this.configService.get<string>(
      'REVALIDATE_SECRET',
    );
  }

  async revalidatePage(slug: string): Promise<void> {
    if (!this.revalidationUrl) {
      this.logger.warn(
        'REVALIDATION_URL not configured — skipping ISR revalidation',
      );
      return;
    }

    const results = await Promise.allSettled(
      SUPPORTED_LOCALES.map((locale) => this.triggerRevalidation(slug, locale)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const locale = SUPPORTED_LOCALES[i];
      if (result.status === 'rejected') {
        this.logger.error(
          `Failed to revalidate /${locale}/${slug}: ${result.reason}`,
        );
      } else {
        this.logger.log(`Revalidated /${locale}/${slug}`);
      }
    }
  }

  private async triggerRevalidation(
    slug: string,
    locale: string,
  ): Promise<void> {
    const url = `${this.revalidationUrl}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': this.revalidateSecret || '',
      },
      body: JSON.stringify({ slug, locale }),
    });

    if (!response.ok) {
      throw new Error(
        `Revalidation failed for /${locale}/${slug}: ${response.status} ${response.statusText}`,
      );
    }
  }
}