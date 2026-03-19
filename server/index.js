import "dotenv/config";
import express from 'express';
import mongoose from 'mongoose';
import { registerRoutes } from './routes.js';
import cors from "cors";
import { registerUploadRoutes } from "./routes/upload.js";

const app = express();
app.use(cors());
app.use(express.json());

const MONGODB_URI = 'mongodb://127.0.0.1:27017/nft_marketplace';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    const PORT = 3000;
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      registerRoutes(app);
    });
  })
  .catch(err => console.error('MongoDB Connection Error:', err));

registerUploadRoutes(app);