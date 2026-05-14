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
  blockNumber:{ type: Number },
  createdAt:  { type: Date, default: Date.now },
});


activitySchema.index({ tx: 1, logIndex: 1 }, { unique: true });
activitySchema.index({ collection: 1, createdAt: -1 });
activitySchema.index({ from: 1, createdAt: -1 });
activitySchema.index({ to: 1, createdAt: -1 });

export const Activity = mongoose.model('Activity', activitySchema);