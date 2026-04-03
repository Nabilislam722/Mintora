import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  walletAddress: { type: String, unique: true, lowercase: true, required: true },
  username: { type: String, default: "" },
  profileImageUrl: { type: String, default: "" },
  bannerImageUrl: { type: String, default: "" },
  bio: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);