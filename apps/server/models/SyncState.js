import mongoose from "mongoose";

const syncStateSchema = new mongoose.Schema({
    key:   { type: String, required: true, unique: true },
    value: { type: Number, required: true },
});

export const SyncState = mongoose.model("SyncState", syncStateSchema);