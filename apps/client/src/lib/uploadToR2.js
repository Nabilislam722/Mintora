export async function uploadToR2(file, uploadType, address, onProgress) {
  const presignRes = await fetch("/api/upload/presign", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({
      fileName:   file.name,
      fileType:   file.type,
      fileSize:   file.size,
      uploadType,
      address,
    }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json();
    throw new Error(err.message || "Failed to get upload URL");
  }

  const { presignedUrl, key, publicUrl } = await presignRes.json();

  onProgress?.(0.1); // started

  const putRes = await fetch(presignedUrl, {
    method:  "PUT",
    headers: { "Content-Type": file.type },
    body:    file,
  });

  if (!putRes.ok) throw new Error("Upload to R2 failed");

  onProgress?.(0.9); // nearly done

  const confirmRes = await fetch("/api/upload/confirm", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ key, publicUrl, uploadType, mimeType: file.type, address }),
  });

  if (!confirmRes.ok) throw new Error("Failed to confirm upload");

  onProgress?.(1.0);
  return publicUrl;
}