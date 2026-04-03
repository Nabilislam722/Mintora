import mongoose from 'mongoose';
import { type } from 'os';

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  description: String,
  logoUrl: String,
  bannerUrl: String,
  contractAddress: { type: String, lowercase: true, required: true, unique: true },
  chain: { type: String, default: 'Hemi' },
  floorPrice: String,
  volume: String,
  sales: String,
  isVerified: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  rarity: { type: String, default: null}
});

export const Collection = mongoose.model('Collection', collectionSchema);