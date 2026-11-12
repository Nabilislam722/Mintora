import mongoose from 'mongoose';

export const MAX_USERNAME = 32;
export const MAX_BIO = 160;

export const USERNAME_COLLATION = { locale: "en", strength: 2 };

const userSchema = new mongoose.Schema({
  walletAddress: { type: String, unique: true, lowercase: true, required: true },
  username: { type: String, default: "" },
  profileImageUrl: { type: String, default: "" },
  bannerImageUrl: { type: String, default: "" },
  bio: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

userSchema.index(
  { username: 1 },
  { unique: true, collation: USERNAME_COLLATION, partialFilterExpression: { username: { $gt: "" } } }
);

export const User = mongoose.model('User', userSchema);

User.on("index", (err) => {
  if (err) console.error("User indexes could not be built:", err.message);
});

// Why a username can't be used, or null if it can
export function usernameProblem(name) {
  if (name === "") return null;
  if (name.length < 2 || name.length > MAX_USERNAME) return `Usernames are 2 to ${MAX_USERNAME} characters.`;
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return "Usernames can use letters, numbers, \"_\", \".\" and \"-\".";
  if (/^0x[0-9a-f]{4,}$/i.test(name)) return "Usernames can't look like a wallet address.";
  return null;
}

// Whether another wallet already has this username
export async function usernameTaken(name, walletAddress) {
  return !!(await User.exists({ username: name, walletAddress: { $ne: walletAddress } }).collation(USERNAME_COLLATION));
}
