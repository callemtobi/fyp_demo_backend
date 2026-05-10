import express from "express";
import {
  createCase,
  getAllCases,
  getCaseById,
  findSimilarCases,
  updateCase,
  closeCase,
  addTimelineEntry,
  linkEvidence,
  getCaseStats,
  getEvidenceUploadTrend,
  getRecentActivity,
  compareCases,
  downloadComparisonPDF,
} from "../controllers/caseController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = express.Router();

// All routes require authentication
router.use(protect);

// Case statistics - before /:id to avoid conflict (all roles can view)
router.get("/stats", getCaseStats);

// Dashboard data routes (all roles can view)
router.get("/dashboard/evidence-trend", getEvidenceUploadTrend);
router.get("/dashboard/recent-activity", getRecentActivity);

// Find similar cases - before /:id to avoid conflict (all roles can view)
router.get("/analyze/similar/:id", findSimilarCases);

// Compare two cases (all roles can view)
router.post("/compare", compareCases);

// Download comparison PDF (all roles can download)
router.post("/comparison/download", downloadComparisonPDF);

// CRUD operations
// Create case: Only Investigator and Police Officer
router.post("/", authorize("Investigator", "Police Officer"), createCase);

// View all cases (all roles can view)
router.get("/", getAllCases);

// View specific case (all roles can view)
router.get("/:id", getCaseById);

// Update case: Only Investigator and Police Officer
router.put("/:id", authorize("Investigator", "Police Officer"), updateCase);

// Case actions
// Close case: Only Investigator and Police Officer
router.put(
  "/:id/close",
  authorize("Investigator", "Police Officer"),
  closeCase,
);

// Add timeline entry: All roles can add
router.post("/:id/timeline", addTimelineEntry);

// Link evidence: All roles can link
router.post("/:id/evidence/:evidenceId", linkEvidence);

export default router;

// ----------------------------------------------------------------------
// GET /api/cases
// Query Parameters:

// status - Filter by status (open, in-progress, closed, archived)
// caseType - Filter by type (criminal, civil, corporate, cyber, other)
// search - Search in title, description, or case number
// limit - Number of cases per page (default: 50)
// page - Page number (default: 1)

// ----------------------------------------------------------------------
// import express from "express";
// import { protect } from "../middleware/auth.js";

// const router = express.Router();
// import {
//   createCase,
//   getAllCases,
//   getCaseById,
//   findSimilarCases,
// } from "../controllers/caseController.js";

// // All routes are protected
// router.use(protect);

// router.post("/", createCase);
// router.get("/", getAllCases);
// router.get("/:id", getCaseById);
// router.get("/analyze/similar/:id", findSimilarCases);

// export default router;

// // Statistics
// GET  /api/cases/stats

// // Similar cases
// GET  /api/cases/analyze/similar/:id

// // CRUD
// POST /api/cases
// GET  /api/cases
// GET  /api/cases/:id
// PUT  /api/cases/:id

// // Actions
// PUT  /api/cases/:id/close
// POST /api/cases/:id/timeline
// POST /api/cases/:id/evidence/:evidenceId
