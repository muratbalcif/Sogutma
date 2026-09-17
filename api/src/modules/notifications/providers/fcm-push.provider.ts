import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PushMessage,
  PushNotificationProvider,
  PushSendResult,
} from './push-provider.interface';

type MessagingLike = {
  sendEachForMulticast: (message: {
    tokens: string[];
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }) => Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{
      success: boolean;
      error?: { code?: string };
    }>;
  }>;
};

type FirebaseAppModule = {
  getApps: () => unknown[];
  initializeApp: (options: {
    credential: unknown;
  }) => unknown;
  cert: (serviceAccount: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  }) => unknown;
};

type FirebaseMessagingModule = {
  getMessaging: (app?: unknown) => MessagingLike;
};

/**
 * FCM via firebase-admin when FIREBASE_* credentials are set.
 * Without credentials: disabled — never reports fake successes.
 */
@Injectable()
export class FcmPushProvider implements PushNotificationProvider {
  private readonly logger = new Logger(FcmPushProvider.name);
  readonly enabled: boolean;
  private readonly projectId?: string;
  private readonly clientEmail?: string;
  private readonly privateKey?: string;
  private initPromise: Promise<boolean> | null = null;
  private messaging: MessagingLike | null = null;

  constructor(private readonly config: ConfigService) {
    this.projectId = this.config.get<string>('FIREBASE_PROJECT_ID')?.trim();
    this.clientEmail = this.config
      .get<string>('FIREBASE_CLIENT_EMAIL')
      ?.trim();
    this.privateKey = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.trim();
    this.enabled = Boolean(
      this.projectId && this.clientEmail && this.privateKey,
    );
    if (!this.enabled) {
      this.logger.warn(
        'FCM credentials missing — push delivery disabled (notifications still persist)',
      );
    }
  }

  sendToToken(token: string, message: PushMessage): Promise<PushSendResult> {
    return this.sendToTokens([token], message);
  }

  async sendToTokens(
    tokens: string[],
    message: PushMessage,
  ): Promise<PushSendResult> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    if (!this.enabled) {
      this.logger.debug(
        `FCM disabled — reporting ${tokens.length} undelivered recipient(s)`,
      );
      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
      };
    }

    const ready = await this.ensureInitialized();
    if (!ready || !this.messaging) {
      return {
        successCount: 0,
        failureCount: tokens.length,
        invalidTokens: [],
      };
    }

    const response = await this.messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: message.title,
        body: message.body,
      },
      data: message.data,
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((item, index) => {
      if (item.success) return;
      const code = item.error?.code ?? '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/invalid-argument'
      ) {
        invalidTokens.push(tokens[index]!);
      }
    });

    if (response.failureCount > 0) {
      this.logger.warn(
        `FCM send title="${message.title}" success=${response.successCount} failure=${response.failureCount}`,
      );
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  }

  /** Test seam — override to inject fake SDK modules. */
  protected async loadFirebase(): Promise<{
    app: FirebaseAppModule;
    messaging: FirebaseMessagingModule;
  }> {
    const app = (await import('firebase-admin/app')) as FirebaseAppModule;
    const messaging = (await import(
      'firebase-admin/messaging'
    )) as FirebaseMessagingModule;
    return { app, messaging };
  }

  private async ensureInitialized(): Promise<boolean> {
    if (!this.enabled) return false;
    if (!this.initPromise) {
      this.initPromise = this.initializeApp().catch((error: unknown) => {
        this.initPromise = null;
        this.messaging = null;
        const message =
          error instanceof Error ? error.message : 'FCM init failed';
        this.logger.error(`FCM initialization failed: ${message}`);
        return false;
      });
    }
    return this.initPromise;
  }

  private async initializeApp(): Promise<boolean> {
    const { app, messaging } = await this.loadFirebase();
    if (app.getApps().length === 0) {
      app.initializeApp({
        credential: app.cert({
          projectId: this.projectId!,
          clientEmail: this.clientEmail!,
          privateKey: this.privateKey!,
        }),
      });
      this.logger.log('FCM firebase-admin initialized');
    }
    this.messaging = messaging.getMessaging();
    return true;
  }
}
