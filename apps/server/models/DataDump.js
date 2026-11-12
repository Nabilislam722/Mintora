import mongoose from 'mongoose';
import { monthKey } from '../lib/months.js';

const marketSchema = new mongoose.Schema({
  sales:         { type: Number, default: 0 },
  volume:        { type: Number, default: 0 },
  volumeUsd:     { type: Number, default: 0 },
  feesEst:       { type: Number, default: 0 },
  listings:      { type: Number, default: 0 },
  delistings:    { type: Number, default: 0 },
  uniqueBuyers:  { type: Number, default: 0 },
  uniqueSellers: { type: Number, default: 0 },
  avgSaleUsd:    { type: Number, default: 0 },
  biggestSale: {
    tokenId:    String,
    collection: String,
    price:      Number,
    usd:        Number,
    tx:         String,
  },
}, { _id: false });

const collectionStatSchema = new mongoose.Schema({
  address:   String,
  name:      String,
  sales:     Number,
  volume:    Number,
  volumeUsd: Number,
}, { _id: false });

const dataDumpSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true },
  final: { type: Boolean, default: false },

  nft:            { type: marketSchema, default: () => ({}) },
  topCollections: { type: [collectionStatSchema], default: [] },
  vehemi:         { type: marketSchema, default: () => ({}) },
  vehemiOffersAccepted: { type: Number, default: 0 },

  wallets: {
    active:    { type: Number, default: 0 },
    traders:   { type: Number, default: 0 },
    new:       { type: Number, default: 0 },
    returning: { type: Number, default: 0 },
  },

  prices: {
    hemiUsd: { type: Number, default: 0 },
    ethUsd:  { type: Number, default: 0 },
    samples: { type: Number, default: 0 },
  },

  updatedAt: { type: Date, default: Date.now },
}, { collection: 'datadump' });

export const DataDump = mongoose.model('DataDump', dataDumpSchema);

// Adds one price sample to the current month's running average
export async function recordPriceSample({ HEMI, ETH } = {}) {
  if (!(HEMI > 0) || !(ETH > 0)) return;
  const n = { $ifNull: ['$prices.samples', 0] };
  const average = (field, value) => ({
    $divide: [{ $add: [{ $multiply: [{ $ifNull: [`$prices.${field}`, 0] }, n] }, value] }, { $add: [n, 1] }],
  });
  await DataDump.updateOne(
    { month: monthKey(new Date()) },
    [{
      $set: {
        'prices.hemiUsd': average('hemiUsd', HEMI),
        'prices.ethUsd': average('ethUsd', ETH),
        'prices.samples': { $add: [n, 1] },
      },
    }],
    { upsert: true, updatePipeline: true }
  );
}
