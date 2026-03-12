import mongoose from 'mongoose';

const featuredSchema = new mongoose.Schema({
    id: { type: Number, required: true, index: true },
    title: String,
    subtitle: String,
    cta: String,
    bgImage: String,
    logoLeft: String,
    logoRight: String
})

export const Featured = mongoose.model('Featured', featuredSchema);