import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2, R2_BUCKET, R2_PUBLIC_URL } from "../lib/r2.js";
import { User } from "../models/User.js";
import crypto from "crypto";

const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "model/gltf-binary", "model/gltf+json", "application/octet-stream",
];

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export function registerUploadRoutes(app) {

    app.post("/api/upload/presign", async (req, res) => {
        const { fileName, fileType, fileSize, uploadType, address } = req.body;

        console.log("R2_ACCESS_KEY_ID:", process.env.R2_ACCESS_KEY_ID ? "set" : " MISSING");
        console.log("R2_SECRET_ACCESS_KEY:", process.env.R2_SECRET_ACCESS_KEY ? "set" : " MISSING");
        console.log("R2_PUBLIC_URL:", process.env.R2_PUBLIC_URL ?? "MISSING");
        console.log("Body received:", req.body);
        if (!fileName || !fileType || !address)
            return res.status(400).json({ message: "fileName, fileType, and address are required." });

        if (!ALLOWED_TYPES.includes(fileType))
            return res.status(400).json({ message: `File type "${fileType}" is not allowed.` });

        if (fileSize && fileSize > 50 * 1024 * 1024)
            return res.status(400).json({ message: "File exceeds 5 MB limit." });

        const ext = fileName.split(".").pop().toLowerCase();
        const uid = crypto.randomUUID();
        const safeType = (uploadType || "general").replace(/[^a-z0-9-]/gi, "");
        const folderMap = {
            avatar: "users",
            banner: "users",
        };

        const folder = folderMap[uploadType] || "uploads/general";
        const key = `${folder}/${address.toLowerCase()}/${uid}.${ext}`;

        try {
            const command = new PutObjectCommand({
                Bucket: R2_BUCKET,
                Key: key,
                ContentType: fileType,
                ...(fileSize ? { ContentLength: fileSize } : {}),
            });

            const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 300 });

            res.json({ presignedUrl, key, publicUrl: `${R2_PUBLIC_URL}/${key}` });
        } catch (err) {
            console.error("R2 presign error:", err);
            res.status(500).json({ message: "Could not generate upload URL." });
        }
    });

    app.post("/api/upload/confirm", async (req, res) => {
        const { publicUrl, uploadType, address } = req.body;

        if (!publicUrl || !address)
            return res.status(400).json({ message: "publicUrl and address are required." });

        // Map uploadType → your exact schema field names
        const fieldMap = {
            avatar: "profileImageUrl",
            banner: "bannerImageUrl",
        };

        const field = fieldMap[uploadType];
        if (!field)
            return res.status(400).json({ message: `Unknown uploadType "${uploadType}". Use "avatar" or "banner".` });

        try {
            const user = await User.findOneAndUpdate(
                { walletAddress: address.toLowerCase() },
                { $set: { [field]: publicUrl } },
                { upsert: true, new: true }
            );

            res.json({ success: true, [field]: publicUrl, user });
        } catch (err) {
            console.error("Upload confirm error:", err);
            res.status(500).json({ message: "Could not save upload record." });
        }
    });
}