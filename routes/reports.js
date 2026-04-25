import express from "express";
import {
  getCaseDetailsForReport,
  logReportGeneration,
  getRecentReports,
} from "../controllers/reportController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get case details by ID
router.get("/case/:id", getCaseDetailsForReport);

// Log report generation
router.post("/log", logReportGeneration);

// Get recent reports
router.get("/recent", getRecentReports);

export default router;
