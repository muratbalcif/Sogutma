import { FcmPushProvider } from './fcm-push.provider';

describe('FcmPushProvider', () => {
  it('reports failures (not success) when credentials are missing', async () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    };
    const provider = new FcmPushProvider(config as never);

    expect(provider.enabled).toBe(false);
    const result = await provider.sendToTokens(['t1', 't2'], {
      title: 'Hi',
      body: 'Body',
    });

    expect(result).toEqual({
      successCount: 0,
      failureCount: 2,
      invalidTokens: [],
    });
  });

  it('returns empty counts for empty token list when disabled', async () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    const provider = new FcmPushProvider(config as never);

    await expect(
      provider.sendToTokens([], { title: 'Hi', body: 'Body' }),
    ).resolves.toEqual({
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
    });
  });

  it('maps multicast results when firebase-admin succeeds', async () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'FIREBASE_PROJECT_ID') return 'demo';
        if (key === 'FIREBASE_CLIENT_EMAIL') return 'demo@example.com';
        if (key === 'FIREBASE_PRIVATE_KEY')
          return '-----BEGIN KEY-----\nabc\n-----END KEY-----';
        return undefined;
      }),
    };
    const provider = new FcmPushProvider(config as never);

    const sendEachForMulticast = jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });

    jest.spyOn(provider as never, 'loadFirebase' as never).mockResolvedValue({
      app: {
        getApps: () => [{}],
        initializeApp: jest.fn(),
        cert: jest.fn().mockReturnValue({ type: 'cert' }),
      },
      messaging: {
        getMessaging: () => ({ sendEachForMulticast }),
      },
    } as never);

    const result = await provider.sendToTokens(['good', 'bad'], {
      title: 'Hi',
      body: 'Body',
    });

    expect(result.successCount).toBe(1);
    expect(result.failureCount).toBe(1);
    expect(result.invalidTokens).toEqual(['bad']);
    expect(sendEachForMulticast).toHaveBeenCalled();
  });
});
