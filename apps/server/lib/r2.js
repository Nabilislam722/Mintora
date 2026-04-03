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