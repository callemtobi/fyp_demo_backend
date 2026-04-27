import mongoose from "mongoose";

// -----------------------------------------------------------
const evidenceSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    // required: true,
    unique: true,
  },
  fileName: {
    type: String,
    required: [true, "File name is required"],
  },
  fileType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  ipfsHash: {
    type: String,
    required: [true, "IPFS hash is required"],
    unique: true,
  },
  fileHash: {
    type: String,
    required: true,
    unique: true, // SHA-256 hash of the file for integrity
  },
  blockchainTxHash: {
    type: String,
    default: null, // Will be updated after blockchain transaction
  },
  blockchainConfirmed: {
    type: Boolean,
    default: false,
  },
  userSignedTxHash: {
    type: String,
    default: null, // Transaction signed by user wallet
  },
  userSignedBlockNumber: {
    type: Number,
    default: null,
  },
  userSignedTimestamp: {
    type: Date,
    default: null,
  },
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  uploaderWallet: {
    type: String,
    required: false,
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    // type: String,
    ref: "Case",
    default: null,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
  },
  tags: [
    {
      type: String,
      trim: true,
    },
  ],
  metadata: {
    evidenceTitle: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    source: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    incidentDate: Date,
    location: String,
    dateCollected: Date,
    collectedBy: String,
    deviceInfo: String,
    notes: String,
  },
  // AI-Generated Content
  pdfText: {
    type: String,
    default: null,
    // Extracted text from PDF files
  },
  imageCaption: {
    type: String,
    default: null,
    // AI-generated caption for image files
  },
  aiProcessingStatus: {
    type: String,
    enum: ["pending", "processing", "completed", "failed"],
    default: "pending",
  },
  chainOfCustody: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      userId: String, // For cases where user ref might not resolve
      userName: String,
      userEmail: String,
      action: {
        type: String,
        enum: [
          "uploaded",
          "viewed",
          "downloaded",
          "transferred",
          "blockchain-confirmed",
        ],
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
      reason: String, // For transfers
      ipAddress: String,
      userAgent: String,
      txHash: String, // For blockchain transactions
    },
  ],
  status: {
    type: String,
    enum: ["pending", "verified", "rejected", "archived"],
    default: "pending",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt timestamp before saving
evidenceSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Generate unique evidence ID
evidenceSchema.pre("save", function () {
  if (!this.evidenceId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 7);
    this.evidenceId = `EVD-${timestamp}-${random}`.toUpperCase();
  }
});

export default mongoose.model("Evidence", evidenceSchema);
