import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EnvironmentVariables } from '../../config/env.validation';

class SiteConfigResponseDto {
  siteName!: string;
  supportEmail!: string;
  supportPhone!: string;
  address!: string;
  privacyUrl!: string;
  kvkkUrl!: string;
  termsUrl!: string;
  bankTransferInfo!: {
    bankName: string;
    iban: string;
    accountName: string;
  };
}

@ApiTags('site')
@Controller('site')
export class SiteController {
  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  @Get('config')
  @ApiOperation({
    summary: 'Public site configuration for footer/contact/bank details',
  })
  @ApiOkResponse({ type: Object })
  getConfig(): SiteConfigResponseDto {
    return {
      siteName:
        this.config.get('SITE_NAME', { infer: true }) ?? 'FurkanSoğutma',
      supportEmail:
        this.config.get('SITE_SUPPORT_EMAIL', { infer: true }) ??
        'info@furkansogutma.com',
      supportPhone:
        this.config.get('SITE_SUPPORT_PHONE', { infer: true }) ??
        '+90 324 000 00 00',
      address:
        this.config.get('SITE_ADDRESS', { infer: true }) ?? 'Mersin, Türkiye',
      privacyUrl:
        this.config.get('SITE_PRIVACY_URL', { infer: true }) ?? '/gizlilik',
      kvkkUrl: this.config.get('SITE_KVKK_URL', { infer: true }) ?? '/kvkk',
      termsUrl:
        this.config.get('SITE_TERMS_URL', { infer: true }) ??
        '/kullanim-kosullari',
      bankTransferInfo: {
        bankName:
          this.config.get('BANK_TRANSFER_BANK_NAME', { infer: true }) ??
          'Örnek Bankası',
        iban:
          this.config.get('BANK_TRANSFER_IBAN', { infer: true }) ??
          'TR000000000000000000000000',
        accountName:
          this.config.get('BANK_TRANSFER_ACCOUNT_NAME', { infer: true }) ??
          'FurkanSoğutma',
      },
    };
  }
}
