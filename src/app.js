import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Import Routes
import analyzeRoutes from "./routes/analyze.js";
import paymentRoutes from "./routes/payment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ================================================
// EXPRESS APP SETUP
// ================================================
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "../public")));

// Routes
app.use("/api", analyzeRoutes);
app.use("/api", paymentRoutes);

// Root route
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ================================================
// START SERVER (Local Development)
const port = process.env.PORT || 5000;
if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`🚀 Server Berjalan di http://localhost:${port}`);
    });
}

export default app;
