import crypto from "crypto";
import { S3Client } from "@aws-sdk/client-s3";

export const r2 = new S3Client({
  region: "auto",
  endpoint: "https://7f01a4eeeb686e2a5b3ce56111555407.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export const R2_BUCKET       = "mintora";
export const R2_PUBLIC_URL   = process.env.R2_PUBLIC_URL;

export const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/webp": "webp" };
// R2 key for a new profile image: users/<wallet>/<uuid>.<ext>
export const userImageKey = (wallet, ext) => `users/${wallet}/${crypto.randomUUID()}.${ext}`;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Whether `url` is a profile image that `wallet` uploaded through Mintora
export function isUserImageUrl(url, wallet) {
  if (!R2_PUBLIC_URL || typeof url !== "string") return false;
  const exts = Object.values(IMAGE_TYPES).join("|");
  return new RegExp(`^${escapeRegExp(R2_PUBLIC_URL)}/users/${wallet}/[0-9a-f-]{36}\\.(${exts})$`).test(url);
}
