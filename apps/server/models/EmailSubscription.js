import crypto from "crypto";
import mongoose from "mongoose";

// A wallet's notification email and which emails it wants.
// Kept out of User on purpose: /api/users/:address and /api/search return User records to anyone.
const emailSubscriptionSchema = new mongoose.Schema({
    walletAddress: { type: String, unique: true, lowercase: true, required: true },
    email: { type: String, default: "" },
    pendingEmail: { type: String, default: "" },
    confirmTokenHash: { type: String },
    confirmExpiresAt: { type: Date },
    confirmSentAt: { type: Date },
    unsubscribeToken: { type: String, unique: true, default: () => crypto.randomBytes(24).toString("base64url") },
    offers: { type: Boolean, default: true },
    sales: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
});
emailSubscriptionSchema.index({ confirmTokenHash: 1 }, { sparse: true });

export const EmailSubscription = mongoose.model("EmailSubscription", emailSubscriptionSchema);

// The settings a wallet sees about itself (never the tokens)
export const emailSettings = (s) => ({
    email: s?.email ?? "",
    pendingEmail: s?.pendingEmail ?? "",
    offers: s?.offers ?? true,
    sales: s?.sales ?? true,
});
