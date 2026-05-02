import Evidence from "../models/Evidence.js";
import Case from "../models/Case.js";
import { uploadToIPFS } from "../services/ipfsService.js";
import { registerEvidence as registerOnBlockchain } from "../services/blockchainService.js";
import { processEvidenceFile } from "../services/fileProcessingService.js";
import { generateEvidenceSummary } from "../services/openaiService.js";
import fs from "fs";

/**
 * Upload evidence with blockchain registration
 */
const uploadEvidence = async (req, res) => {
  const uploadedFilePaths = [];
  let statusCode = 500;

  try {
    const uploadedFiles = req.files || [];

    if (!uploadedFiles.length) {
      statusCode = 400;
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    if (!req.body.caseId) {
      statusCode = 400;
      return res.status(400).json({
        success: false,
        message: "Case selection is required",
      });
    }

    const caseRecord = await Case.findById(req.body.caseId);
    if (!caseRecord) {
      statusCode = 404;
      return res.status(404).json({
        success: false,
        message: "Selected case not found",
      });
    }

    const validMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/jpg",
      "application/pdf",
      "video/mp4",
      "video/webm",
      "video/quicktime",
    ];

    const parsedTags = req.body.tags
      ? req.body.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    let metadata = {};
    let fileDurations = {};
    try {
      metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
      fileDurations = req.body.fileDurations
        ? JSON.parse(req.body.fileDurations)
        : {};
    } catch (parseError) {
      statusCode = 400;
      throw new Error("Invalid metadata payload");
    }

    const createdEvidence = [];

    for (const uploadedFile of uploadedFiles) {
      if (!validMimeTypes.includes(uploadedFile.mimetype)) {
        statusCode = 400;
        throw new Error(
          `Unsupported file type for ${uploadedFile.originalname}. Only image, PDF, and video are allowed.`,
        );
      }

      if (uploadedFile.mimetype.startsWith("video/")) {
        const videoDurationSeconds = Number(
          fileDurations[uploadedFile.originalname] ?? 0,
        );

        if (!videoDurationSeconds || videoDurationSeconds > 10) {
          statusCode = 400;
          throw new Error(
            `Video ${uploadedFile.originalname} must be 10 seconds or less.`,
          );
        }
      }

      uploadedFilePaths.push(uploadedFile.path);

      const fileName = uploadedFile.originalname;

      // 1. Upload to IPFS
      console.log("📤 Step 1: Uploading to IPFS...", fileName);
      const ipfsResult = await uploadToIPFS(uploadedFile.path, fileName);

      if (!ipfsResult.success) {
        throw new Error(`IPFS upload failed for ${fileName}`);
      }

      const { ipfsHash, fileHash, gatewayUrl } = ipfsResult;

      // 2. Register on blockchain
      console.log("📝 Step 2: Registering on blockchain...", fileName);
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

      // 3. Process file content (Extract PDF text / Generate image captions)
      console.log("🔄 Step 3: Processing file content...", fileName);
      const processingResult = await processEvidenceFile(
        uploadedFile.path,
        uploadedFile.mimetype,
        req.body.description || "",
      );

      // 4. Save to MongoDB
      const evidence = await Evidence.create({
        fileName: fileName,
        fileType: uploadedFile.mimetype,
        fileSize: uploadedFile.size,
        ipfsHash: ipfsHash,
        fileHash: fileHash,
        blockchainTxHash: blockchainTxHash,
        blockchainConfirmed: blockchainConfirmed,
        uploader: req.user.id,
        uploaderWallet: req.body.walletAddress || null,
        caseId: req.body.caseId,
        description: req.body.description,
        tags: parsedTags,
        metadata: {
          evidenceTitle: metadata.evidenceTitle || "",
          source: metadata.source || "",
          incidentDate: metadata.incidentDate || null,
          location: metadata.location || "",
          dateCollected: metadata.dateCollected || null,
          collectedBy: metadata.collectedBy || "",
          deviceInfo: metadata.deviceInfo || "",
          notes: metadata.notes || "",
        },
        // AI-Generated Content
        pdfText: processingResult.pdfText,
        imageCaption: processingResult.imageCaption,
        aiProcessingStatus: processingResult.aiProcessingStatus,
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
      });

      createdEvidence.push({
        _id: evidence._id,
        evidenceId: evidence.evidenceId,
        ipfsHash: evidence.ipfsHash,
        fileHash: evidence.fileHash,
        blockchainTxHash: evidence.blockchainTxHash,
        ipfsUrl: gatewayUrl,
      });

      caseRecord.evidence.push(evidence._id);
    }

    await caseRecord.save();

    // 5. Cleanup
    uploadedFilePaths.forEach((filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    // 5.5. Generate evidence summary using OpenAI
    console.log("🔄 Step 5.5: Generating evidence summary with OpenAI...");
    try {
      // Fetch all evidence for the case with all fields
      const allEvidences = await Evidence.find(
        { caseId: req.body.caseId },
        "fileName fileType pdfText imageCaption",
      );

      if (allEvidences.length > 0) {
        const evidenceSummary = await generateEvidenceSummary(allEvidences);
        if (evidenceSummary) {
          caseRecord.caseAnalysisSummary = {
            ...caseRecord.caseAnalysisSummary,
            evidenceSummary: evidenceSummary,
            lastUpdated: new Date(),
          };
          await caseRecord.save();
          console.log("✅ Evidence summary generated and stored");
        }
      }
    } catch (summaryError) {
      console.warn(
        "⚠️ Failed to generate evidence summary:",
        summaryError.message,
      );
      // Don't fail the upload if summary generation fails
    }

    // 6. Return response
    res.status(201).json({
      success: true,
      message: "Evidence uploaded successfully",
      data: {
        caseId: caseRecord._id,
        filesCount: createdEvidence.length,
        evidences: createdEvidence,
      },
    });
  } catch (error) {
    console.error("❌ Upload error:", error);

    uploadedFilePaths.forEach((filePath) => {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    res.status(statusCode).json({
      success: false,
      message: "Error uploading evidence",
      error: error.message,
    });
  }
};

/**
 * Get all evidence records
 */
const getAllEvidence = async (req, res) => {
  try {
    const { caseId } = req.query;
    const filter = {};

    if (caseId) {
      filter.caseId = caseId;
    }

    const evidence = await Evidence.find(filter)
      .populate("uploader", "name email")
      .populate("caseId", "title caseNumber");

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

/**
 * Confirm user-signed blockchain transaction
 */
const confirmBlockchainTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { transactionHash, blockNumber } = req.body;

    console.log("🔗 Confirming blockchain transaction...");
    console.log("   Evidence ID:", id);
    console.log("   TX Hash:", transactionHash);
    console.log("   Block Number:", blockNumber);

    if (!transactionHash) {
      return res.status(400).json({
        success: false,
        message: "Transaction hash is required",
      });
    }

    // Find evidence record
    const evidence = await Evidence.findById(id);

    if (!evidence) {
      console.error("❌ Evidence not found with ID:", id);
      return res.status(404).json({
        success: false,
        message: "Evidence not found",
      });
    }

    console.log("✅ Evidence found:", evidence.fileName);
    console.log("   IPFS Hash:", evidence.ipfsHash);
    console.log("   File Hash:", evidence.fileHash);

    // Import blockchainService function
    console.log("📥 Importing blockchainService...");
    const blockchainModule = await import("../services/blockchainService.js");
    const verifyUserTransaction = blockchainModule.verifyUserTransaction;

    console.log("🔍 Verifying transaction on blockchain...");

    // Verify transaction on blockchain
    const verifyResult = await verifyUserTransaction(
      transactionHash,
      evidence.ipfsHash,
      evidence.fileHash,
    );

    if (!verifyResult.success) {
      console.error("❌ Transaction verification failed:", verifyResult.error);
      return res.status(400).json({
        success: false,
        message: "Transaction verification failed",
        error: verifyResult.error,
      });
    }

    console.log("✅ Transaction verified on blockchain");
    console.log("   Block:", verifyResult.blockNumber);
    console.log("   Gas Used:", verifyResult.gasUsed);

    // Update evidence with user-signed transaction details
    const updatedEvidence = await Evidence.findByIdAndUpdate(
      id,
      {
        userSignedTxHash: transactionHash,
        userSignedBlockNumber: blockNumber || verifyResult.blockNumber,
        userSignedTimestamp: new Date(),
        blockchainConfirmed: true,
        $push: {
          chainOfCustody: {
            user: req.user.id,
            userId: req.user.id,
            userName: req.user.name,
            userEmail: req.user.email,
            action: "blockchain-confirmed",
            timestamp: new Date(),
            txHash: transactionHash,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get("user-agent"),
            reason: "Evidence registered on Polygon Amoy blockchain",
          },
        },
      },
      { new: true },
    )
      .populate("uploader", "name email")
      .populate("caseId", "caseTitle");

    console.log("✅ User-signed transaction confirmed:");
    console.log("   Evidence ID:", id);
    console.log("   TX Hash:", transactionHash);
    console.log("   Block Number:", blockNumber);

    res.status(200).json({
      success: true,
      message: "Blockchain transaction confirmed",
      data: {
        evidence: {
          evidenceId: updatedEvidence.evidenceId,
          ipfsHash: updatedEvidence.ipfsHash,
          fileHash: updatedEvidence.fileHash,
          userSignedTxHash: updatedEvidence.userSignedTxHash,
          userSignedBlockNumber: updatedEvidence.userSignedBlockNumber,
          blockchainExplorer: `https://amoy.polygonscan.com/tx/${transactionHash}`,
        },
        verification: verifyResult,
      },
    });
  } catch (error) {
    console.error("❌ Error confirming blockchain transaction:", error);
    console.error("   Error message:", error.message);
    console.error("   Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Error confirming blockchain transaction",
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
  confirmBlockchainTransaction,
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
      .populate("caseId", "caseNumber title _id")
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
        description: evidence.description,
        imageCaption: evidence.imageCaption,
        metadata: evidence.metadata,
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
