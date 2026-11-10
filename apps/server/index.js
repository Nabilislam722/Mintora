import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { registerRoutes } from "./routes.js";
import { registerUploadRoutes } from "./routes/upload.js";
import { registerAuthRoutes } from "./routes/auth.js";

const app = express();

// Sites that may call the API, and the only ones a wallet sign-in message can be written for
const ORIGINS = [
  "https://mintora.app",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

const corsOptions = {
  origin: ORIGINS,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

registerAuthRoutes(app, ORIGINS);
registerRoutes(app);
registerUploadRoutes(app);

const MONGODB_URI = "mongodb://127.0.0.1:27017/nft_marketplace";
const PORT = 3000;

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => console.error("MongoDB Connection Error:", err));