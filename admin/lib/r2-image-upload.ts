import { catalogService } from "@/services/admin-api.service";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  resizeImageForUpload,
} from "@/lib/resize-image";

/** Resize (if needed) then R2 presign + PUT. Returns public URL and object key. */
export async function uploadResizedImage(params: {
  file: File;
  folder: string;
  maxBytes?: number;
}): Promise<{ publicUrl: string; objectKey: string; file: File }> {
  const maxBytes = params.maxBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const file = await resizeImageForUpload(params.file, { maxBytes });
  const contentType = file.type || "image/jpeg";

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
  };
}
