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
          _id: evidence._id,
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
