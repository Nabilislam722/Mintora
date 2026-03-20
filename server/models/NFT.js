import mongoose from 'mongoose';
import { type } from 'os';

const nftSchema = new mongoose.Schema({
  collectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Collection' },
  contractAddress: { type: String, required: true, lowercase: true, index: true }, 
  tokenId: { type: String, required: true, index: true },
  name: String,
  description: String,
  imageUrl: String,
  attributes: Array, 
  ownerAddress: { type: String, lowercase: true, index: true },
  isListed: { type: Boolean, default: false },
  price: { type: String, default: "0" },
  seller: { type: String, lowercase: true },
  priority: { type: Number, default: 0 },
  lastSyncedAt: { type: Date, default: Date.now },
  priceChange: { type: String, default: "0"}
});

nftSchema.index({ contractAddress: 1, tokenId: 1 }, { unique: true });

export const NFT = mongoose.model('NFT', nftSchema);