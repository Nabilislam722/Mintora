import mongoose from "mongoose";

const sessionSchema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true },
    address: { type: String, required: true, lowercase: true },
    expiresAt: { type: Date, required: true },
});
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.model("Session", sessionSchema);

const signInChallengeSchema = new mongoose.Schema({
    nonce: { type: String, required: true, unique: true },
    address: { type: String, required: true, lowercase: true },
    message: { type: String, required: true },
    expiresAt: { type: Date, required: true },
});
signInChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const SignInChallenge = mongoose.model("SignInChallenge", signInChallengeSchema);
