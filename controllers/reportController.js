import Case from "../models/Case.js";
import Report from "../models/Report.js";

/**
 * Get case details by ID for reporting
 * GET /api/reports/case/:id
 */
const getCaseDetailsForReport = async (req, res) => {
  try {
    const { id } = req.params;

    const caseData = await Case.findById(id)
      .populate("assignedOfficer", "name email username")
      .populate({
        path: "evidence",
        select: "fileName uploadDate fileHash fileSize",
      });

    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Case details retrieved successfully",
      data: caseData,
    });
  } catch (error) {
    console.error("Error fetching case details:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching case details",
      error: error.message,
    });
  }
};

/**
 * Log report generation for audit trail
 * POST /api/reports/log
 */
const logReportGeneration = async (req, res) => {
  try {
    const { caseId, reportName } = req.body;

    if (!caseId) {
      return res.status(400).json({
        success: false,
        message: "Case ID is required",
      });
    }

    // Verify case exists
    const caseData = await Case.findById(caseId);
    if (!caseData) {
      return res.status(404).json({
        success: false,
        message: "Case not found",
      });
    }

    // Create report log entry
    const report = await Report.create({
      caseId,
      fileName: reportName || `Report-${caseData.caseNumber}-${Date.now()}`,
      generatedAt: new Date(),
      generatedBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Report generation logged successfully",
      data: {
        reportId: report._id,
        caseId: report.caseId,
        generatedAt: report.generatedAt,
      },
    });
  } catch (error) {
    console.error("Error logging report:", error);
    return res.status(500).json({
      success: false,
      message: "Error logging report generation",
      error: error.message,
    });
  }
};

/**
 * Get recent reports
 * GET /api/reports/recent
 */
const getRecentReports = async (req, res) => {
  try {
    const reports = await Report.find()
      .populate("caseId", "caseNumber title")
      .populate("generatedBy", "name username")
      .sort({ generatedAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      message: "Recent reports retrieved successfully",
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching reports",
      error: error.message,
    });
  }
};

export { getCaseDetailsForReport, logReportGeneration, getRecentReports };
