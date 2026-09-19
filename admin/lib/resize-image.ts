/** Client-side product image optimization before R2 presign (API limit 5 MB). */

export const API_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_EDGE = 1920;
export const WEBP_QUALITY_STEPS = [0.85, 0.8, 0.75, 0.7, 0.65] as const;

/** @deprecated use API_MAX_UPLOAD_BYTES — kept for callers */
export const DEFAULT_MAX_UPLOAD_BYTES = API_MAX_UPLOAD_BYTES;

export type OptimizeImageResult = {
  file: File;
  originalBytes: number;
  optimizedBytes: number;
  wasOptimized: boolean;
  width: number;
  height: number;
};

export function computeTargetSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function toWebpFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "") || "image";
  return `${base}.webp`;
}

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSizeReduction(
  originalBytes: number,
  optimizedBytes: number,
): string {
  return `${formatByteSize(originalBytes)} → ${formatByteSize(optimizedBytes)}`;
}

/** Pure decision: skip canvas work when already fit for upload. */
export function shouldSkipOptimization(input: {
  size: number;
  type: string;
  width: number;
  height: number;
  maxBytes?: number;
  maxEdge?: number;
}): boolean {
  const maxBytes = input.maxBytes ?? API_MAX_UPLOAD_BYTES;
  const maxEdge = input.maxEdge ?? DEFAULT_MAX_IMAGE_EDGE;
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(input.type)) return false;
  if (input.size > maxBytes) return false;
  if (input.width > maxEdge || input.height > maxEdge) return false;
  return true;
}

async function decodeBitmap(
  file: File,
): Promise<{ bitmap: ImageBitmap; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file, {
      // Honor EXIF orientation when the browser supports it.
      imageOrientation: "from-image",
    } as ImageBitmapOptions);
    return {
      bitmap,
      width: bitmap.width,
      height: bitmap.height,
    };
  } catch {
    // Fallback without orientation hint (older browsers).
    const bitmap = await createImageBitmap(file);
    return { bitmap, width: bitmap.width, height: bitmap.height };
  }
}

async function canvasToWebpBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({
      type: "image/webp",
      quality,
    });
    if (!blob || blob.type !== "image/webp") {
      throw new Error("WebP dönüşümü desteklenmiyor");
    }
    return blob;
  }
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality),
  );
  if (!blob) {
    throw new Error("Görsel sıkıştırılamadı");
  }
  return blob;
}

function drawBitmap(
  bitmap: ImageBitmap,
  width: number,
  height: number,
): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas desteklenmiyor");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas desteklenmiyor");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/**
 * Optimize for R2 upload: max 1920², WebP, quality ladder down to 0.65.
 * Skips work when already WebP, ≤5 MB, and within max edge.
 */
export async function optimizeImageForUpload(
  file: File,
  options: {
    maxBytes?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {},
): Promise<OptimizeImageResult> {
  const maxBytes = options.maxBytes ?? API_MAX_UPLOAD_BYTES;
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_IMAGE_EDGE;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_IMAGE_EDGE;

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const inputType = file.type || "image/jpeg";
  if (!allowed.includes(inputType)) {
    throw new Error("Only JPEG, PNG, and WEBP images are allowed");
  }

  const { bitmap, width: srcW, height: srcH } = await decodeBitmap(file);
  try {
    const target = computeTargetSize(srcW, srcH, maxWidth, maxHeight);

    if (
      shouldSkipOptimization({
        size: file.size,
        type: inputType,
        width: srcW,
        height: srcH,
        maxBytes,
        maxEdge: Math.max(maxWidth, maxHeight),
      })
    ) {
      return {
        file,
        originalBytes: file.size,
        optimizedBytes: file.size,
        wasOptimized: false,
        width: srcW,
        height: srcH,
      };
    }

    const canvas = drawBitmap(bitmap, target.width, target.height);
    let blob: Blob | null = null;
    let usedQuality: number = WEBP_QUALITY_STEPS[0];

    for (const quality of WEBP_QUALITY_STEPS) {
      usedQuality = quality;
      blob = await canvasToWebpBlob(canvas, quality);
      if (blob.size <= maxBytes) break;
    }

    if (!blob || blob.size > maxBytes) {
      throw new Error(
        `Görsel ${formatByteSize(maxBytes)} altına indirilemedi (WebP q≥${usedQuality}). Daha sade bir görsel seçin.`,
      );
    }

    const out = new File([blob], toWebpFilename(file.name), {
      type: "image/webp",
      lastModified: Date.now(),
    });

    return {
      file: out,
      originalBytes: file.size,
      optimizedBytes: out.size,
      wasOptimized: true,
      width: target.width,
      height: target.height,
    };
  } finally {
    bitmap.close();
  }
}

/** @deprecated prefer optimizeImageForUpload */
export async function resizeImageForUpload(
  file: File,
  options: {
    maxBytes?: number;
    maxWidth?: number;
    maxHeight?: number;
  } = {},
): Promise<File> {
  const result = await optimizeImageForUpload(file, options);
  return result.file;
}
