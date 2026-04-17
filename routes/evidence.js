import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
// import { uploadEvidence } from "../controllers/evidenceController.js";
import { protect } from "../middleware/auth.js";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Import controllers
import {
  uploadEvidence,
  getAllEvidence,
  getEvidenceById,
  downloadEvidence,
  updateBlockchainHash,
  confirmBlockchainTransaction,
  trackEvidenceView,
  trackEvidenceDownload,
  getChainOfCustody,
} from "../controllers/evidenceController.js";

const router = express.Router();
// Ensure uploads directory exists
// const uploadsDir = path.join(__dirname, "../uploads");
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
//   console.log("📁 Created uploads directory:", uploadsDir);
// }

// Ensure uploads directory exists
const uploadsDir = "./uploads";
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadsDir);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(
//       null,
//       file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
//     );
//   },
// });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "_");
    cb(null, `${sanitizedName}-${uniqueSuffix}${ext}`);
  },
});

// const upload = multer({
//   storage: storage,
//   limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
// });

// Routes
// router.post("/upload", protect, upload.single("file"), uploadEvidence);
// router.get("/verify/:ipfsHash", protect, verifyEvidenceIntegrity);

// // -------------------------------------------------------------------

// Import auth middleware
// import { protect } from "../middleware/auth.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: function (req, file, cb) {
    console.log("📎 Receiving file:", file.originalname);
    console.log("📎 File mimetype:", file.mimetype);

    // Accept all file types for forensic evidence
    // You can add restrictions here if needed
    const allowedMimes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "video/mp4",
      "video/mpeg",
      "application/zip",
    ];

    // For now, allow all files (comment out to restrict)
    // cb(null, true);

    // Uncomment to restrict file types:
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Only images, PDFs, and documents allowed.",
        ),
      );
    }
  },
});

// Error handling middleware for multer
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 100MB.",
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
  next();
};

// All routes are protected
router.use(protect);

// Upload route with file handling
router.post(
  "/upload",
  upload.single("file"),
  handleMulterError,
  uploadEvidence,
);

// Other routes
router.get("/", getAllEvidence);
router.get("/:id", getEvidenceById);
router.get("/:id/download", downloadEvidence);
router.put("/:id/blockchain", updateBlockchainHash);
router.post("/:id/confirm-blockchain", confirmBlockchainTransaction);

// Chain of Custody routes
router.post("/:id/track-view", trackEvidenceView);
router.post("/:id/track-download", trackEvidenceDownload);
router.get("/:id/chain-of-custody", getChainOfCustody);

export default router;

// --------------------------------

// import express from "express";
// import multer from "multer";
// import path from "path";

// const router = express.Router();
// import {
//   uploadEvidence,
//   getAllEvidence,
//   getEvidenceById,
//   downloadEvidence,
//   updateBlockchainHash,
// } from "../controllers/evidenceController.js";
// import { protect } from "../middleware/auth.js";

// // Configure multer for file uploads
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads/");
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
//     cb(
//       null,
//       file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
//     );
//   },
// });

// const upload = multer({
//   storage: storage,
//   limits: {
//     fileSize: 100 * 1024 * 1024, // 100MB limit
//   },
//   fileFilter: function (req, file, cb) {
//     // Add file type validation if needed
//     cb(null, true);
//   },
// });

// // All routes are protected
// router.use(protect);

// router.post("/upload", upload.single("file"), uploadEvidence);
// router.get("/", getAllEvidence);
// router.get("/:id", getEvidenceById);
// router.get("/:id/download", downloadEvidence);
// router.put("/:id/blockchain", updateBlockchainHash);

// export default router;
