import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KolayBiClient, KOLAYBI_DEFAULT_TIMEOUT_MS } from './kolaybi.client';
import { KolayBiApiError } from './kolaybi.errors';
import { KolayBiInvoiceProvider } from '../providers/kolaybi.invoice-provider';

function mockConfig(values: Record<string, string | boolean | undefined>) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

function jsonResponse(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as Response;
}

function fetchMock(): jest.MockedFunction<typeof fetch> {
  return global.fetch as jest.MockedFunction<typeof fetch>;
}

describe('KolayBiClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('is disabled when credentials are missing', () => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: '',
        KOLAYBI_API_KEY: '',
        KOLAYBI_CHANNEL: '',
        KOLAYBI_SANDBOX: true,
      }),
    );
    expect(client.isConfigured()).toBe(false);
    expect(client.enabled).toBe(false);
  });

  it('reads config and enables when all credentials present', () => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'test-key',
        KOLAYBI_CHANNEL: 'test-channel',
        KOLAYBI_SANDBOX: true,
      }),
    );
    expect(client.isConfigured()).toBe(true);
    expect(client.isSandbox()).toBe(true);
    expect(client.getBaseUrl()).toBe('https://ofis-sandbox-api.kolaybi.com');
  });

  it('uses KOLAYBI_API_BASE_URL as source of truth (strips trailing slash)', () => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://example.test/',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
        KOLAYBI_SANDBOX: false,
      }),
    );
    expect(client.getBaseUrl()).toBe('https://example.test');
    expect(client.isSandbox()).toBe(false);
  });

  it('throws not-configured on authenticate when disabled', async () => {
    const client = new KolayBiClient(mockConfig({}));
    await expect(client.authenticate()).rejects.toMatchObject({
      code: 'KOLAYBI_NOT_CONFIGURED',
    });
  });

  it('acquires access token from { data: string } response', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: 'tok-abc' }));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'test-key',
        KOLAYBI_CHANNEL: 'test-channel',
        KOLAYBI_SANDBOX: true,
      }),
    );

    await client.authenticate();
    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe(
      'https://ofis-sandbox-api.kolaybi.com/kolaybi/v1/access_token',
    );
    const headers = init?.headers as Record<string, string>;
    expect(headers.Channel).toBe('test-channel');
    expect(headers.Authorization).toBeUndefined();
    expect(init?.body).toBe(JSON.stringify({ api_key: 'test-key' }));
  });

  it('caches token and does not re-authenticate on subsequent calls', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: 'tok-cached' }));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'test-key',
        KOLAYBI_CHANNEL: 'test-channel',
      }),
    );

    await client.authenticate();
    await client.authenticate();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('single-flights concurrent token refreshes', async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    global.fetch = jest.fn().mockReturnValue(pending);

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'test-key',
        KOLAYBI_CHANNEL: 'test-channel',
      }),
    );

    const p1 = client.getAccessToken();
    const p2 = client.getAccessToken();
    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(jsonResponse(200, { data: 'tok-race' }));

    const [t1, t2] = await Promise.all([p1, p2]);
    expect(t1).toBe('tok-race');
    expect(t2).toBe('tok-race');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes token after invalidate', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok-2' }));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'test-key',
        KOLAYBI_CHANNEL: 'test-channel',
      }),
    );

    await client.authenticate();
    client.invalidateToken();
    await client.authenticate();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('normalizes 401 from access_token', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse(401, '{"error":"bad key"}'));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'bad',
        KOLAYBI_CHANNEL: 'c',
      }),
    );

    await expect(client.authenticate()).rejects.toMatchObject({
      statusCode: 401,
      code: 'KOLAYBI_UNAUTHORIZED',
      retryable: false,
    });
  });

  it('marks 429 and 5xx as retryable', async () => {
    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
      }),
    );

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(429, 'slow down'));

    await expect(client.request('/companies')).rejects.toMatchObject({
      statusCode: 429,
      retryable: true,
      code: 'KOLAYBI_RATE_LIMITED',
    });

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(503, 'down'));

    client.invalidateToken();
    await expect(client.request('/companies')).rejects.toMatchObject({
      statusCode: 503,
      retryable: true,
    });
  });

  it('handles timeout via AbortError', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
      }),
    );

    await expect(
      client.request('/access_token', {
        method: 'POST',
        skipAuth: true,
        body: { api_key: 'k' },
        timeoutMs: KOLAYBI_DEFAULT_TIMEOUT_MS,
      }),
    ).rejects.toMatchObject({
      code: 'KOLAYBI_TIMEOUT',
      retryable: true,
    });
  });

  it('does not log api key, channel, or access token', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: 'super-secret-token-value' }),
      );

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'super-secret-api-key',
        KOLAYBI_CHANNEL: 'super-secret-channel',
      }),
    );

    await client.authenticate();

    const logged = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('super-secret-api-key');
    expect(logged).not.toContain('super-secret-channel');
    expect(logged).not.toContain('super-secret-token-value');
    expect(logged).toContain('/access_token');
  });

  it('sends Bearer + Channel on authenticated requests', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok-xyz' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'ch-1',
      }),
    );

    await client.request('/companies');
    const [, init] = fetchMock().mock.calls[1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok-xyz');
    expect(headers.Channel).toBe('ch-1');
  });
});

describe('KolayBiInvoiceProvider health', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns enabled=false when not configured', async () => {
    const client = new KolayBiClient(mockConfig({}));
    const provider = new KolayBiInvoiceProvider(client);
    const health = await provider.healthCheck();
    expect(health.enabled).toBe(false);
    expect(health.ok).toBe(false);
    expect(health.code).toBe('NOT_CONFIGURED');
    expect(health.provider).toBe('KOLAYBI');
  });

  it('returns ok=true after auth + companies', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: 'tok' }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: 1 } }));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
        KOLAYBI_SANDBOX: true,
      }),
    );
    const provider = new KolayBiInvoiceProvider(client);
    const health = await provider.healthCheck();
    expect(health).toMatchObject({
      provider: 'KOLAYBI',
      enabled: true,
      ok: true,
      sandbox: true,
      code: 'OK',
    });
  });

  it('returns ok=false on provider failure without throwing', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(403, 'forbidden'));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
      }),
    );
    const provider = new KolayBiInvoiceProvider(client);
    const health = await provider.healthCheck();
    expect(health.ok).toBe(false);
    expect(health.enabled).toBe(true);
    expect(health.code).toBe('FORBIDDEN');
    expect(health.message).toContain('forbidden');
  });

  it('distinguishes 401 unauthorized from missing config', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse(401, 'bad key'));

    const client = new KolayBiClient(
      mockConfig({
        KOLAYBI_API_BASE_URL: 'https://ofis-sandbox-api.kolaybi.com',
        KOLAYBI_API_KEY: 'k',
        KOLAYBI_CHANNEL: 'c',
      }),
    );
    const provider = new KolayBiInvoiceProvider(client);
    const health = await provider.healthCheck();
    expect(health.enabled).toBe(true);
    expect(health.ok).toBe(false);
    expect(health.code).toBe('UNAUTHORIZED');
  });
});

describe('kolayBi error helpers', () => {
  it('classifies 403 as non-retryable', () => {
    const err = new KolayBiApiError('x', 403, 'KOLAYBI_FORBIDDEN', false);
    expect(err.retryable).toBe(false);
  });
});
