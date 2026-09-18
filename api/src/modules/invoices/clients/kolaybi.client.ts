import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../../../config/env.validation';
import {
  KolayBiApiError,
  kolayBiErrorFromHttpStatus,
  kolayBiNotConfiguredError,
  kolayBiTimeoutError,
} from './kolaybi.errors';

/** Matches order outbound HTTP timeout convention (15s). */
export const KOLAYBI_DEFAULT_TIMEOUT_MS = 15_000;

/** Official token lifetime is 24h; refresh early to avoid edge expiry. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;

export type KolayBiRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** When true, skip Authorization header (access_token endpoint). */
  skipAuth?: boolean;
  timeoutMs?: number;
  /** JSON (default) or form-urlencoded body serialization. */
  contentType?: 'json' | 'form';
};

/**
 * Low-level KolayBi HTTP client.
 * Base URL source of truth: KOLAYBI_API_BASE_URL (no hardcoded host).
 * Never logs API key, channel, or access token.
 */
@Injectable()
export class KolayBiClient {
  private readonly logger = new Logger(KolayBiClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly channel: string;
  private readonly sandbox: boolean;
  readonly enabled: boolean;

  private accessToken: string | null = null;
  private tokenExpiresAtMs = 0;
  private refreshPromise: Promise<string> | null = null;

  constructor(
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.baseUrl = (
      this.config.get('KOLAYBI_API_BASE_URL', { infer: true }) ?? ''
    )
      .trim()
      .replace(/\/$/, '');
    this.apiKey = (
      this.config.get('KOLAYBI_API_KEY', { infer: true }) ?? ''
    ).trim();
    this.channel = (
      this.config.get('KOLAYBI_CHANNEL', { infer: true }) ?? ''
    ).trim();
    this.sandbox = this.config.get('KOLAYBI_SANDBOX', { infer: true }) ?? true;

    this.enabled = Boolean(this.baseUrl && this.apiKey && this.channel);

    if (!this.enabled) {
      this.logger.warn(
        'KolayBi credentials incomplete — invoice provider disabled until KOLAYBI_API_BASE_URL, KOLAYBI_API_KEY, and KOLAYBI_CHANNEL are set',
      );
    } else if (this.sandbox) {
      this.logger.log('KolayBi client configured (sandbox mode flag=true)');
    } else {
      this.logger.log('KolayBi client configured (sandbox mode flag=false)');
    }
  }

  isConfigured(): boolean {
    return this.enabled;
  }

  isSandbox(): boolean {
    return this.sandbox;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /** Force next request to fetch a new access token. */
  invalidateToken(): void {
    this.accessToken = null;
    this.tokenExpiresAtMs = 0;
  }

  /**
   * Obtain (or reuse) Bearer access token.
   * Single-flight: concurrent callers share one refresh promise.
   */
  async authenticate(): Promise<void> {
    await this.getAccessToken();
  }

  async getAccessToken(): Promise<string> {
    this.assertConfigured();

    if (this.accessToken && Date.now() < this.tokenExpiresAtMs) {
      return this.accessToken;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.fetchAccessToken().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  /**
   * Authenticated (or skipAuth) request against `/kolaybi/v1{path}`.
   * On 401 with auth, invalidates token and retries once.
   */
  async request<T = unknown>(
    path: string,
    options: KolayBiRequestOptions = {},
  ): Promise<T> {
    this.assertConfigured();

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${this.baseUrl}/kolaybi/v1${normalizedPath}`;
    const method = options.method ?? 'GET';
    const timeoutMs = options.timeoutMs ?? KOLAYBI_DEFAULT_TIMEOUT_MS;

    const doFetch = async (token: string | null): Promise<Response> => {
      const headers: Record<string, string> = {
        Channel: this.channel,
        Accept: 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      let body: string | undefined;
      if (options.body !== undefined && options.body !== null) {
        if (options.contentType === 'form') {
          headers['Content-Type'] = 'application/x-www-form-urlencoded';
          body =
            typeof options.body === 'string'
              ? options.body
              : new URLSearchParams(
                  options.body as Record<string, string>,
                ).toString();
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify(options.body);
        }
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        return await fetch(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });
      } catch (err) {
        if (isAbortError(err)) {
          throw kolayBiTimeoutError();
        }
        throw new KolayBiApiError(
          'KolayBi network error',
          503,
          'KOLAYBI_NETWORK_ERROR',
          true,
        );
      } finally {
        clearTimeout(timer);
      }
    };

    let token: string | null = null;
    if (!options.skipAuth) {
      token = await this.getAccessToken();
    }

    let response = await doFetch(token);

    if (response.status === 401 && !options.skipAuth) {
      this.invalidateToken();
      token = await this.getAccessToken();
      response = await doFetch(token);
    }

    this.logger.log(
      JSON.stringify({
        provider: 'KOLAYBI',
        method,
        path: normalizedPath,
        status: response.status,
      }),
    );

    if (!response.ok) {
      const safeDetail = await readSafeErrorDetail(response);
      throw kolayBiErrorFromHttpStatus(response.status, safeDetail);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      throw new KolayBiApiError(
        'KolayBi returned non-JSON response',
        502,
        'KOLAYBI_INVALID_RESPONSE',
        true,
      );
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const body = await this.request<{ data?: unknown } | string>(
      '/access_token',
      {
        method: 'POST',
        skipAuth: true,
        body: { api_key: this.apiKey },
        contentType: 'json',
      },
    );

    const token = extractToken(body);
    if (!token) {
      throw new KolayBiApiError(
        'KolayBi access token response missing data',
        502,
        'KOLAYBI_INVALID_TOKEN_RESPONSE',
        true,
      );
    }

    this.accessToken = token;
    this.tokenExpiresAtMs = Date.now() + TOKEN_TTL_MS - TOKEN_REFRESH_SKEW_MS;
    this.logger.log('KolayBi access token acquired');
    return token;
  }

  private assertConfigured(): void {
    if (!this.enabled) {
      throw kolayBiNotConfiguredError();
    }
  }
}

function extractToken(body: unknown): string | null {
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }
  if (body && typeof body === 'object' && 'data' in body) {
    const data = body.data;
    if (typeof data === 'string' && data.length > 0) {
      return data;
    }
  }
  return null;
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === 'AbortError') ||
    (typeof err === 'object' &&
      err !== null &&
      'name' in err &&
      (err as { name: string }).name === 'AbortError')
  );
}

async function readSafeErrorDetail(response: Response): Promise<string> {
  try {
    const text = await response.text();
    // Never forward raw bodies that might echo credentials; keep short & scrubbed.
    return text
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/api_key["']?\s*[:=]\s*["']?[^"',}\s]+/gi, 'api_key=[REDACTED]')
      .slice(0, 200);
  } catch {
    return '';
  }
}
