// Uploads one profile image (uploadType "avatar" or "banner") straight to R2 and returns its public URL.
// `send` is a signed-in fetch (see lib/auth.js). The image only appears on the profile once it's saved with this URL.
export async function uploadToR2(file, uploadType, send, onProgress) {
  const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

  const presignRes = await send(`${BASE_URL}/api/upload/presign`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ fileType: file.type, fileSize: file.size, uploadType }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.message || "Failed to get upload URL");
  }

  const { presignedUrl, publicUrl } = await presignRes.json();

  onProgress?.(0.1); // started

  // The URL is signed for exactly this type and size
  const putRes = await fetch(presignedUrl, {
    method:  "PUT",
    headers: { "Content-Type": file.type },
    body:    file,
  });

  if (!putRes.ok) throw new Error("Upload to R2 failed");

  onProgress?.(1.0);
  return publicUrl;
}
