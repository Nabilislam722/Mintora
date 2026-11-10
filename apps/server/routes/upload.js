import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET, R2_PUBLIC_URL, IMAGE_TYPES, userImageKey } from "../lib/r2.js";
import { requireAuth } from "../lib/auth.js";

const UPLOAD_TYPES = new Set(["avatar", "banner"]);
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export function registerUploadRoutes(app) {

    // A one-time URL for the signed-in wallet to upload one profile image to R2. The image is only used once the
    // profile is saved with its URL (PATCH /api/users/:address).
    app.post("/api/upload/presign", requireAuth, async (req, res) => {
        const { fileType, fileSize, uploadType } = req.body ?? {};

        if (!UPLOAD_TYPES.has(uploadType))
            return res.status(400).json({ message: 'uploadType must be "avatar" or "banner".' });

        const ext = IMAGE_TYPES[fileType];
        if (!ext) return res.status(400).json({ message: "Use a JPG, PNG, WEBP or GIF image." });

        if (!Number.isInteger(fileSize) || fileSize <= 0 || fileSize > MAX_SIZE)
            return res.status(400).json({ message: "Images can be up to 5 MB." });

        const key = userImageKey(req.wallet, ext);
        try {
            const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: fileType, ContentLength: fileSize });
            // Size and type are both signed, so R2 refuses an upload of any other size, or one labelled as
            // something else (an HTML page served from the image domain, for example)
            const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300, signableHeaders: new Set(["content-type"]) });
            res.json({ presignedUrl, key, publicUrl: `${R2_PUBLIC_URL}/${key}` });
        } catch (err) {
            console.error("R2 presign error:", err);
            res.status(500).json({ message: "Could not generate upload URL." });
        }
    });
}
