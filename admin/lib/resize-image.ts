/** Client-side image downscale before R2 presign (3MB client target). */

export const DEFAULT_MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
/** Prefer crisp catalog photos; only shrink below this if still over budget. */
export const DEFAULT_MAX_IMAGE_EDGE = 2048;
export const DEFAULT_MIN_IMAGE_EDGE = 1280;

export type ResizeImageOptions = {
  maxBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  minEdge?: number;
  /** Output MIME; JPEG is preferred for photos (smaller). */
  outputType?: "image/jpeg" | "image/webp";
  initialQuality?: number;
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

/** Scale both axes by the same factor; keep the longer edge >= minEdge when possible. */
export function scaleDownKeepingAspect(
  width: number,
  height: number,
  factor: number,
  minEdge: number,
): { width: number; height: number } {
  const nextW = Math.max(1, Math.round(width * factor));
  const nextH = Math.max(1, Math.round(height * factor));
  const longEdge = Math.max(nextW, nextH);
  if (longEdge >= minEdge || longEdge === Math.max(width, height)) {
    return { width: nextW, height: nextH };
  }
  // Would drop below minEdge — clamp long edge to minEdge instead.
  const boost = minEdge / longEdge;
  return {
    width: Math.max(1, Math.round(nextW * boost)),
    height: Math.max(1, Math.round(nextH * boost)),
  };
}

function extensionForMime(mime: string): string {
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  return "jpg";
}

function replaceExtension(filename: string, ext: string): string {
  const base = filename.replace(/\.[^.]+$/, "") || "image";
  return `${base}.${ext}`;
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Görsel okunamadı"));
      img.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), type, quality),
  );
  if (!blob) {
    throw new Error("Görsel sıkıştırılamadı");
  }
  return blob;
}

/**
 * Downscale + recompress so the file fits under maxBytes.
 * Prefers keeping resolution (≥ minEdge) and lowering JPEG quality first.
 */
export async function resizeImageForUpload(
  file: File,
  options: ResizeImageOptions = {},
): Promise<File> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const maxWidth = options.maxWidth ?? DEFAULT_MAX_IMAGE_EDGE;
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_IMAGE_EDGE;
  const minEdge = options.minEdge ?? DEFAULT_MIN_IMAGE_EDGE;
  const outputType = options.outputType ?? "image/jpeg";
  let quality = options.initialQuality ?? 0.9;

  const allowed = ["image/jpeg", "image/png", "image/webp"];
  const inputType = file.type || "image/jpeg";
  if (!allowed.includes(inputType)) {
    throw new Error("Only JPEG, PNG, and WEBP images are allowed");
  }

  const image = await loadImage(file);
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  let { width, height } = computeTargetSize(srcW, srcH, maxWidth, maxHeight);

  const needsResize =
    file.size > maxBytes || width < srcW || height < srcH;

  if (!needsResize) {
    return file;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas desteklenmiyor");
  }

  const draw = async (): Promise<Blob> => {
    canvas.width = width;
    canvas.height = height;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, width, height);
    return canvasToBlob(canvas, outputType, quality);
  };

  let blob = await draw();
  // 1) Prefer quality steps while keeping current resolution.
  while (blob.size > maxBytes && quality > 0.72) {
    quality = Math.max(0.72, Math.round((quality - 0.06) * 100) / 100);
    blob = await draw();
  }

  // 2) Gentle resolution steps; do not go below minEdge until necessary.
  let guard = 0;
  while (blob.size > maxBytes && guard < 6) {
    guard += 1;
    const longEdge = Math.max(width, height);
    if (longEdge <= minEdge) break;
    const next = scaleDownKeepingAspect(width, height, 0.9, minEdge);
    if (next.width === width && next.height === height) break;
    width = next.width;
    height = next.height;
    quality = Math.min(0.88, quality + 0.04);
    blob = await draw();
    while (blob.size > maxBytes && quality > 0.7) {
      quality = Math.max(0.7, Math.round((quality - 0.05) * 100) / 100);
      blob = await draw();
    }
  }

  // 3) Last resort: allow down to 1024 long edge.
  const absoluteMin = 1024;
  guard = 0;
  while (blob.size > maxBytes && guard < 8) {
    guard += 1;
    const longEdge = Math.max(width, height);
    if (longEdge <= absoluteMin) {
      if (quality <= 0.62) break;
      quality = Math.max(0.62, quality - 0.05);
      blob = await draw();
      continue;
    }
    const next = scaleDownKeepingAspect(width, height, 0.88, absoluteMin);
    width = next.width;
    height = next.height;
    quality = Math.min(0.85, Math.max(quality, 0.75));
    blob = await draw();
  }

  if (blob.size > maxBytes) {
    throw new Error(
      `Görsel ${Math.round(maxBytes / (1024 * 1024))} MB altına indirilemedi (çözünürlük korunarak). Daha sade bir görsel deneyin.`,
    );
  }

  return new File(
    [blob],
    replaceExtension(file.name, extensionForMime(outputType)),
    {
      type: outputType,
      lastModified: Date.now(),
    },
  );
}
