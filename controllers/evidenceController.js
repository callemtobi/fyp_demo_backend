import Evidence from "../models/Evidence.js";
import { uploadToIPFS, generateFileHash } from "../services/ipfsService.js";
import { registerEvidence as registerOnBlockchain } from "../services/blockchainService.js";
import fs from "fs";

/**
 * Upload evidence with blockchain registration
 */
const uploadEvidence = async (req, res) => {
  let uploadedFilePath = null;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    uploadedFilePath = req.file.path;
    const fileName = req.file.originalname;

    // 1. Upload to IPFS
    console.log("📤 Step 1: Uploading to IPFS...");
    const ipfsResult = await uploadToIPFS(uploadedFilePath, fileName);

    if (!ipfsResult.success) {
      throw new Error("IPFS upload failed");
    }

    const { ipfsHash, fileHash, gatewayUrl } = ipfsResult;

    // 2. Register on blockchain
    console.log("📝 Step 2: Registering on blockchain...");
    const blockchainResult = await registerOnBlockchain(ipfsHash, fileHash);

    let blockchainTxHash = null;
    let blockchainConfirmed = false;

    if (blockchainResult.success) {
      blockchainTxHash = blockchainResult.transactionHash;
      blockchainConfirmed = true;
      console.log("✅ Blockchain registration complete");
    } else {
      console.warn(
        "⚠️  Blockchain registration failed:",
        blockchainResult.error,
      );
    }

    // 3. Save to MongoDB
    const evidence = await Evidence.create({
      fileName: fileName,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      ipfsHash: ipfsHash,
      fileHash: fileHash,
      blockchainTxHash: blockchainTxHash,
      blockchainConfirmed: blockchainConfirmed,
      uploader: req.user.id,
      caseId: req.body.caseId || null,
      description: req.body.description,
      chainOfCustody: [
        {
          user: req.user.id,
          userId: req.user.id,
          userName: req.user.name,
          userEmail: req.user.email,
          action: "uploaded",
          timestamp: new Date(),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get("user-agent"),
        },
      ],
      // ... other fields
    });

    // 4. Cleanup
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    // 5. Return response
    res.status(201).json({
      success: true,
      message: "Evidence uploaded successfully",
      data: {
        evidence: {
          evidenceId: evidence.evidenceId,
          ipfsHash: evidence.ipfsHash,
          fileHash: evidence.fileHash,
          blockchainTxHash: evidence.blockchainTxHash,
        },
        ipfsUrl: gatewayUrl,
        blockchainExplorer: blockchainTxHash
          ? `https://amoy.polygonscan.com/tx/${blockchainTxHash}`
          : null,
      },
    });
  } catch (error) {
    console.error("❌ Upload error:", error);

    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      fs.unlinkSync(uploadedFilePath);
    }

    res.status(500).json({
      success: false,
      message: "Error uploading evidence",
      error: error.message,
    });
  }
};

// NOTHING
// -------------------------------------------------------------------------------------------------

// const uploadEvidence = async (req, res) => {
//   let uploadedFilePath = null;

//   try {
//     // 1. Validate file upload
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: "No file uploaded",
//       });
//     }

//     uploadedFilePath = req.file.path;
//     const fileName = req.file.originalname;

//     console.log("📤 Starting evidence upload process...");
//     console.log("   File:", fileName);

//     // 2. Upload to IPFS
//     console.log("📤 Step 1: Uploading to IPFS...");
//     const ipfsResult = await uploadToIPFS(uploadedFilePath, fileName);

//     if (!ipfsResult.success) {
//       throw new Error("IPFS upload failed");
//     }

//     const { ipfsHash, fileHash, gatewayUrl } = ipfsResult;

//     console.log("✅ IPFS upload complete");
//     console.log("   IPFS Hash:", ipfsHash);
//     console.log("   File Hash:", fileHash);

//     // 3. Register on blockchain
//     console.log("📝 Step 2: Registering on blockchain...");
//     const blockchainResult = await registerOnBlockchain(ipfsHash, fileHash);

//     let blockchainTxHash = null;
//     let blockchainConfirmed = false;

//     if (blockchainResult.success) {
//       blockchainTxHash = blockchainResult.transactionHash;
//       blockchainConfirmed = true;
//       console.log("✅ Blockchain registration complete");
//       console.log("   TX Hash:", blockchainTxHash);
//     } else {
//       console.warn(
//         "⚠️  Blockchain registration failed:",
//         blockchainResult.error,
//       );
//       // Continue anyway - we still have IPFS
//     }

//     // 4. Parse additional data
//     const collectionInfo = req.body.collectionInfo
//       ? JSON.parse(req.body.collectionInfo)
//       : {};

//     const deviceInfo = req.body.deviceInfo
//       ? JSON.parse(req.body.deviceInfo)
//       : {};

//     const metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};

//     // 5. Create evidence record in MongoDB
//     console.log("💾 Step 3: Saving to database...");
//     const evidence = await Evidence.create({
//       fileName: fileName,
//       fileType: req.file.mimetype,
//       fileSize: req.file.size,
//       ipfsHash: ipfsHash,
//       fileHash: fileHash,
//       blockchainTxHash: blockchainTxHash,
//       blockchainConfirmed: blockchainConfirmed,
//       uploader: req.user.id,
//       caseId: req.body.caseId || null,
//       description: req.body.description,
//       collectionInfo: collectionInfo,
//       deviceInfo: deviceInfo,
//       metadata: metadata,
//       findings: req.body.findings || null,
//     });

//     console.log("✅ Evidence record created");
//     console.log("   Evidence ID:", evidence.evidenceId);

//     // 6. Delete local file
//     if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
//       fs.unlinkSync(uploadedFilePath);
//       console.log("🗑️  Local file deleted");
//     }

//     // 7. Return success response
//     res.status(201).json({
//       success: true,
//       message: "Evidence uploaded successfully",
//       data: {
//         evidence: {
//           evidenceId: evidence.evidenceId,
//           fileName: evidence.fileName,
//           ipfsHash: evidence.ipfsHash,
//           fileHash: evidence.fileHash,
//           blockchainTxHash: evidence.blockchainTxHash,
//           blockchainConfirmed: evidence.blockchainConfirmed,
//           status: evidence.status,
//         },
//         ipfsUrl: gatewayUrl,
//         blockchainExplorer: blockchainTxHash
//           ? `https://amoy.polygonscan.com/tx/${blockchainTxHash}`
//           : null,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Upload evidence error:", error);

//     // Clean up file on error
//     if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
//       fs.unlinkSync(uploadedFilePath);
//       console.log("🗑️  Cleaned up file after error");
//     }

//     res.status(500).json({
//       success: false,
//       message: "Error uploading evidence",
//       error: error.message,
//     });
//   }
// };

/**
 * Get all evidence records
 */
const getAllEvidence = async (req, res) => {
  try {
    const evidence = await Evidence.find()
      .populate("uploader", "name email")
      .populate("caseId", "caseTitle");

    res.status(200).json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    console.error("❌ Error fetching evidence:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching evidence",
      error: error.message,
    });
  }
};

/**
 * Get evidence by ID
 */
const getEvidenceById = async (req, res) => {
  try {
    const { id } = req.params;

    const evidence = await Evidence.findById(id)
      .populate("uploader", "name email")
      .populate("caseId", "caseTitle");

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    res.status(200).json({
      success: true,
      data: evidence,
    });
  } catch (error) {
    console.error("❌ Error fetching evidence:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching evidence",
      error: error.message,
    });
  }
};

/**
 * Download evidence from IPFS
 */
const downloadEvidence = async (req, res) => {
  try {
    const { id } = req.params;

    const evidence = await Evidence.findById(id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    // Redirect to IPFS gateway or the file can be downloaded via the IPFS hash
    const ipfsGateway = `https://gateway.pinata.cloud/ipfs/${evidence.ipfsHash}`;

    res.status(200).json({
      success: true,
      message: "Download link generated",
      data: {
        evidenceId: evidence._id,
        fileName: evidence.fileName,
        fileType: evidence.fileType,
        ipfsHash: evidence.ipfsHash,
        downloadUrl: ipfsGateway,
      },
    });
  } catch (error) {
    console.error("❌ Error downloading evidence:", error);
    res.status(500).json({
      success: false,
      message: "Error downloading evidence",
      error: error.message,
    });
  }
};

/**
 * Update blockchain transaction hash
 */
const updateBlockchainHash = async (req, res) => {
  try {
    const { id } = req.params;
    const { blockchainTxHash, blockchainConfirmed } = req.body;

    if (!blockchainTxHash) {
      return res.status(400).json({
        success: false,
        message: "Blockchain transaction hash is required",
      });
    }

    const evidence = await Evidence.findByIdAndUpdate(
      id,
      {
        blockchainTxHash,
        blockchainConfirmed: blockchainConfirmed || true,
      },
      { new: true },
    );

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Evidence blockchain hash updated",
      data: evidence,
    });
  } catch (error) {
    console.error("❌ Error updating blockchain hash:", error);
    res.status(500).json({
      success: false,
      message: "Error updating blockchain hash",
      error: error.message,
    });
  }
};

export {
  uploadEvidence,
  getAllEvidence,
  getEvidenceById,
  downloadEvidence,
  updateBlockchainHash,
  trackEvidenceView,
  trackEvidenceDownload,
  getChainOfCustody,
};

/**
 * Track evidence view
 */
const trackEvidenceView = async (req, res) => {
  try {
    const { id } = req.params;
    const { ipAddress, userAgent } = req.body;

    const evidence = await Evidence.findById(id)
      .populate("uploader", "name email")
      .lean();

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    // Add to chain of custody
    const updateResult = await Evidence.findByIdAndUpdate(
      id,
      {
        $push: {
          chainOfCustody: {
            user: req.user.id,
            userId: req.user.id,
            userName: req.user.name,
            userEmail: req.user.email,
            action: "viewed",
            timestamp: new Date(),
            ipAddress: ipAddress,
            userAgent: userAgent,
          },
        },
      },
      { new: true },
    )
      .populate("uploader", "name email")
      .populate("caseId", "caseTitle");

    res.status(200).json({
      success: true,
      message: "Evidence view tracked",
      data: updateResult,
    });
  } catch (error) {
    console.error("❌ Error tracking evidence view:", error);
    res.status(500).json({
      success: false,
      message: "Error tracking evidence view",
      error: error.message,
    });
  }
};

/**
 * Track evidence download
 */
const trackEvidenceDownload = async (req, res) => {
  try {
    const { id } = req.params;
    const { ipAddress, userAgent } = req.body;

    const evidence = await Evidence.findById(id);

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    // Add to chain of custody
    const updateResult = await Evidence.findByIdAndUpdate(
      id,
      {
        $push: {
          chainOfCustody: {
            user: req.user.id,
            userId: req.user.id,
            userName: req.user.name,
            userEmail: req.user.email,
            action: "downloaded",
            timestamp: new Date(),
            ipAddress: ipAddress,
            userAgent: userAgent,
          },
        },
      },
      { new: true },
    )
      .populate("uploader", "name email")
      .populate("caseId", "caseTitle");

    // Return the download link
    const ipfsGateway = `https://gateway.pinata.cloud/ipfs/${evidence.ipfsHash}`;

    res.status(200).json({
      success: true,
      message: "Evidence download tracked and link generated",
      data: {
        evidenceId: updateResult._id,
        fileName: updateResult.fileName,
        fileType: updateResult.fileType,
        ipfsHash: updateResult.ipfsHash,
        downloadUrl: ipfsGateway,
      },
    });
  } catch (error) {
    console.error("❌ Error tracking evidence download:", error);
    res.status(500).json({
      success: false,
      message: "Error tracking evidence download",
      error: error.message,
    });
  }
};

/**
 * Get chain of custody for an evidence
 */
const getChainOfCustody = async (req, res) => {
  try {
    const { id } = req.params;

    const evidence = await Evidence.findById(id)
      .populate("uploader", "name email _id")
      .populate("caseId", "caseTitle _id")
      .populate("chainOfCustody.user", "name email _id")
      .lean();

    if (!evidence) {
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    // Format the chain of custody with initial uploader
    const chainOfCustody = evidence.chainOfCustody.map((entry) => ({
      _id: entry._id,
      user: entry.user || {
        name: evidence.uploader.name,
        email: evidence.uploader.email,
      },
      action: entry.action,
      timestamp: entry.timestamp,
      reason: entry.reason,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      txHash: entry.txHash,
    }));

    res.status(200).json({
      success: true,
      data: {
        evidenceId: evidence._id,
        evidenceName: evidence.fileName,
        ipfsHash: evidence.ipfsHash,
        fileHash: evidence.fileHash,
        uploader: evidence.uploader,
        caseId: evidence.caseId,
        createdAt: evidence.createdAt,
        blockchainTxHash: evidence.blockchainTxHash,
        blockchainConfirmed: evidence.blockchainConfirmed,
        chainOfCustody: chainOfCustody,
        totalAccess: chainOfCustody.length,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching chain of custody:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching chain of custody",
      error: error.message,
    });
  }
};
