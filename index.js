import express from "express";
import cors from "cors";
import "dotenv/config";
import mongoose from "mongoose";
mongoose.connect("mongodb://localhost:27017/FYP");

mongoose.connection.on(
  "error",
  console.error.bind(console, "connection error:"),
);
mongoose.connection.once("open", () => {
  console.log("-----> Database connected");
});
// import { configDotenv } from "dotenv";
// import connectDB from "./config/database.js";

const app = express();
const PORT = process.env.PORT || 8000;

import authRoutes from "./routes/auth.js";
import caseRoutes from "./routes/cases.js";
import evidenceRoutes from "./routes/evidence.js";
import reportRoutes from "./routes/reports.js";
const corsOptions = { origin: [process.env.FRONTEND_URL], credentials: true };

// Middleware
app.use(express.static("./public"));
// app.use("/uploads", express.static("./uploads")); // Serve uploaded files
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(express.json());
app.use(cors(corsOptions)); // for cross-origin requests/frontend-backend communication

app.use("/api/auth", authRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/reports", reportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});
// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});
console.log(process.env.JWT_SECRET);

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});
