import express from "express";
import {
  getCaseDetailsForReport,
  logReportGeneration,
  getRecentReports,
} from "../controllers/reportController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Get case details by ID - all roles can access
router.get("/case/:id", getCaseDetailsForReport);

// Log report generation - Only Investigator and Forensic Analyst
router.post(
  "/log",
  authorize("Investigator", "Forensic Analyst"),
  logReportGeneration,
);

// Get recent reports - all roles
router.get("/recent", getRecentReports);

export default router;
