import { catalogService } from "@/services/admin-api.service";
import {
  API_MAX_UPLOAD_BYTES,
  optimizeImageForUpload,
  type OptimizeImageResult,
} from "@/lib/resize-image";

export type UploadPhase = "optimizing" | "uploading";

/** Optimize (if needed) then R2 presign + PUT. Secrets never leave the API. */
export async function uploadResizedImage(params: {
  file: File;
  folder: string;
  maxBytes?: number;
  onPhase?: (phase: UploadPhase, info?: OptimizeImageResult) => void;
}): Promise<{
  publicUrl: string;
  objectKey: string;
  file: File;
  optimize: OptimizeImageResult;
}> {
  const maxBytes = params.maxBytes ?? API_MAX_UPLOAD_BYTES;
  params.onPhase?.("optimizing");
  const optimize = await optimizeImageForUpload(params.file, { maxBytes });
  params.onPhase?.("optimizing", optimize);

  const file = optimize.file;
  const contentType = file.type || "image/webp";

  if (file.size > maxBytes) {
    throw new Error(`Dosya boyutu limiti aşıldı (${maxBytes} bayt)`);
  }

  params.onPhase?.("uploading", optimize);

  const presign = await catalogService.presignUpload({
    filename: file.name,
    contentType,
    folder: params.folder,
    contentLength: file.size,
  });

  if (file.size > presign.maxBytes) {
    throw new Error(`Dosya boyutu limiti aşıldı (${presign.maxBytes} bayt)`);
  }

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`R2 upload failed (${put.status})`);
  }

  return {
    publicUrl: presign.publicUrl,
    objectKey: presign.objectKey,
    file,
    optimize,
  };
}
