/**
 * Photo upload helper: shrinks a picked or captured image to a JPEG small
 * enough to send to /api/analyze, in the browser.
 */
import { ANALYZE_IMAGE_MAX_EDGE } from "./analyze";

export interface EncodedImage {
  /** Base64 JPEG without the data: prefix. */
  data: string;
  mimeType: "image/jpeg";
  /** Object URL for a preview thumbnail; revoke it when done. */
  previewUrl: string;
}

export async function encodePhoto(file: File, maxEdge = ANALYZE_IMAGE_MAX_EDGE, quality = 0.82): Promise<EncodedImage> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  // createImageBitmap honors EXIF orientation with this option, so phone photos aren't sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("Couldn't read that photo. Try a JPEG or PNG.");
  });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that photo.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't process that photo.");
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't process that photo."));
    reader.readAsDataURL(blob);
  });
  return { data: dataUrl.slice(dataUrl.indexOf(",") + 1), mimeType: "image/jpeg", previewUrl: URL.createObjectURL(blob) };
}
