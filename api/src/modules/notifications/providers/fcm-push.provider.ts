import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PushMessage,
  PushNotificationProvider,
  PushSendResult,
} from './push-provider.interface';

/**
 * FCM foundation. Without credentials the provider is disabled and no-ops.
 * Never throws on missing credentials so the API can boot in development.
 */
@Injectable()
export class FcmPushProvider implements PushNotificationProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY');
    this.enabled = Boolean(projectId && clientEmail && privateKey);
    if (!this.enabled) {
      this.logger.warn(
        'FCM credentials missing — push delivery disabled (notifications still persist)',
      );
    }
  }

  sendToToken(token: string, message: PushMessage): Promise<PushSendResult> {
    return this.sendToTokens([token], message);
  }

  sendToTokens(
    tokens: string[],
    message: PushMessage,
  ): Promise<PushSendResult> {
    if (!this.enabled || tokens.length === 0) {
      return Promise.resolve({
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
      });
    }

    // Real firebase-admin integration comes later.
    // Foundation logs safe metadata only (never tokens in full).
    this.logger.debug(
      `FCM stub send title="${message.title}" recipients=${tokens.length}`,
    );
    return Promise.resolve({
      successCount: tokens.length,
      failureCount: 0,
      invalidTokens: [],
    });
  }
}
