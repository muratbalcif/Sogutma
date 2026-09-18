export class KolayBiApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    retryable: boolean,
  ) {
    super(message);
    this.name = 'KolayBiApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
  }
}

export function kolayBiErrorFromHttpStatus(
  status: number,
  safeDetail?: string,
): KolayBiApiError {
  const detail = safeDetail?.slice(0, 200) ?? '';
  const suffix = detail ? `: ${detail}` : '';

  switch (status) {
    case 400:
      return new KolayBiApiError(
        `KolayBi validation error${suffix}`,
        400,
        'KOLAYBI_VALIDATION_ERROR',
        false,
      );
    case 401:
      return new KolayBiApiError(
        'KolayBi authentication failed',
        401,
        'KOLAYBI_UNAUTHORIZED',
        false,
      );
    case 403:
      return new KolayBiApiError(
        'KolayBi access forbidden',
        403,
        'KOLAYBI_FORBIDDEN',
        false,
      );
    case 404:
      return new KolayBiApiError(
        `KolayBi resource not found${suffix}`,
        404,
        'KOLAYBI_NOT_FOUND',
        false,
      );
    case 409:
      return new KolayBiApiError(
        `KolayBi conflict${suffix}`,
        409,
        'KOLAYBI_CONFLICT',
        false,
      );
    case 429:
      return new KolayBiApiError(
        'KolayBi rate limited',
        429,
        'KOLAYBI_RATE_LIMITED',
        true,
      );
    case 500:
    case 502:
    case 503:
    case 504:
      return new KolayBiApiError(
        `KolayBi upstream error (${status})`,
        status,
        'KOLAYBI_UPSTREAM_ERROR',
        true,
      );
    default:
      return new KolayBiApiError(
        `KolayBi HTTP ${status}${suffix}`,
        status,
        status >= 500 ? 'KOLAYBI_UPSTREAM_ERROR' : 'KOLAYBI_ERROR',
        status >= 500,
      );
  }
}

export function kolayBiTimeoutError(): KolayBiApiError {
  return new KolayBiApiError(
    'KolayBi request timed out',
    503,
    'KOLAYBI_TIMEOUT',
    true,
  );
}

export function kolayBiNotConfiguredError(): KolayBiApiError {
  return new KolayBiApiError(
    'KolayBi integration is not configured (KOLAYBI_API_BASE_URL / KOLAYBI_API_KEY / KOLAYBI_CHANNEL)',
    503,
    'KOLAYBI_NOT_CONFIGURED',
    false,
  );
}
