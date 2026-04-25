import express from "express";
import {
  register,
  login,
  getUser,
  logout,
  getUsers,
} from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes
router.get("/getUser", protect, getUser);
router.get("/users", protect, getUsers);
router.post("/logout", protect, logout);

export default router;
