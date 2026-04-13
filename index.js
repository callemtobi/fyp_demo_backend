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
// import dashboardRoutes from "./routes/dashboard.js";
const corsOptions = { origin: [process.env.FRONTEND_URL], credentials: true };

// Middleware
app.use(express.static("./public"));
// app.use("/uploads", express.static("./uploads")); // Serve uploaded files
app.use(express.urlencoded({ extended: false }));
app.set("view engine", "ejs");
app.use(express.json());
app.use(cors(corsOptions)); // for cross-origin requests/frontend-backend communication

// Connect to MongoDB
// connectDB();

// Routes
// app.get("/", (req, res) => {
//   res.json({
//     success: true,
//     message: "Welcome to the Forensic Case Management API",
//   });
// });
// import User from "./models/User.js";
// app.get("/all", async (req, res) => {
//   try {
//     const users = await User.find();
//     res.json({
//       success: true,
//       message: "All users retrieved successfully",
//       data: users,
//     });
//   } catch (error) {
//     console.error("Error retrieving users:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error retrieving users",
//       error: error.message,
//     });
//   }
// });

// app.post("/login", async (req, res) => {
//   try {
//     const { email, password, role } = req.body;

//     const user = await User.findOne({ email, role });
//     if (!user) {
//       return res
//         .status(404)
//         .json({ success: false, message: "User not found or role mismatch" });
//     }

//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Invalid password" });
//     }

//     res.json({
//       success: true,
//       message: "Login successful",
//       data: { email: user.email, role: user.role },
//     });
//   } catch (error) {
//     console.error("Login error:", error);
//     res
//       .status(500)
//       .json({ success: false, message: "Server error", error: error.message });
//   }
// });

app.use("/api/auth", authRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/cases", caseRoutes);
// app.use("/api", dashboardRoutes);

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
