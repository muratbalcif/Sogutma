export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushSendResult = {
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
};

export interface PushNotificationProvider {
  readonly enabled: boolean;
  sendToToken(token: string, message: PushMessage): Promise<PushSendResult>;
  sendToTokens(tokens: string[], message: PushMessage): Promise<PushSendResult>;
}
