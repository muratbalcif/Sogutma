import type { ApiErrorBody } from "../types/api";

export type PosRequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export type PosHttpClient = <T>(
  path: string,
  options?: PosRequestOptions,
) => Promise<T>;

let httpClient: PosHttpClient | null = null;

/** Wire the host app HTTP layer (Tauri Vite client or Admin apiRequest). */
export function configurePosHttp(client: PosHttpClient): void {
  httpClient = client;
}

export function posRequest<T>(
  path: string,
  options: PosRequestOptions = {},
): Promise<T> {
  if (!httpClient) {
    throw new Error(
      "POS HTTP client is not configured. Call configurePosHttp() before POS API calls.",
    );
  }
  return httpClient<T>(path, options);
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody | null;

  constructor(status: number, message: string, body: ApiErrorBody | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function isApiErrorLike(
  error: unknown,
): error is { status: number; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError || isApiErrorLike(error)) {
    const msg = error.message.toLowerCase();
    if (msg.includes("insufficient stock") || msg.includes("stok")) {
      return "Bu ürün için yeterli stok bulunmuyor.";
    }
    if (msg.includes("credit limit")) {
      return "Müşterinin kullanılabilir kredi limiti yetersiz.";
    }
    if (error.status === 403) {
      return "Bu işlem için yetkiniz bulunmuyor.";
    }
    if (error.status === 0 || error.message.includes("bağlanılamadı")) {
      return "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.";
    }
    return error.message;
  }
  if (error instanceof TypeError) {
    return "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.";
  }
  if (error instanceof Error) return error.message;
  return "Beklenmeyen bir hata oluştu.";
}
