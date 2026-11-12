import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  tx:         { type: String, required: true },
  logIndex:   { type: Number },
  type:       { type: String, enum: ['LIST', 'SOLD', 'UPDATE', 'CANCEL', 'TRANSFER'] },
  from:       { type: String, lowercase: true },
  to:         { type: String, lowercase: true },
  collection: { type: String, lowercase: true },
  tokenId:    { type: String },
  price:      { type: String, default: '0' },
  // "vehemi" for veHEMI market sales, priced in HEMI. NFT market rows (priced in ETH) leave it out.
  market:     { type: String },
  // A veHEMI sale made by accepting an offer, rather than buying a listing
  viaOffer:   { type: Boolean },
  blockNumber:{ type: Number },
  createdAt:  { type: Date, default: Date.now },
});


activitySchema.index({ tx: 1, logIndex: 1 }, { unique: true });
activitySchema.index({ collection: 1, createdAt: -1 });
activitySchema.index({ from: 1, createdAt: -1 });
activitySchema.index({ to: 1, createdAt: -1 });
// The site-wide activity feed, and the week of sales that collection order reads (lib/trending.js)
activitySchema.index({ createdAt: -1 });
// The activity page's filters: sales or listings (type), and veHEMI sales (market)
activitySchema.index({ type: 1, createdAt: -1 });
activitySchema.index({ market: 1, createdAt: -1 }, { sparse: true });

export const Activity = mongoose.model('Activity', activitySchema);
