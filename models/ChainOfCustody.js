import mongoose from "mongoose";

const chainOfCustodySchema = new mongoose.Schema({
  cocId: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
  },
  evidenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Evidence",
    required: [true, "Evidence ID is required"],
  },
  handler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Handler is required"],
  },
  action: {
    type: String,
    enum: [
      "collected",
      "transferred",
      "released",
      "stored",
      "accessed",
      "destroyed",
    ],
    required: [true, "Action is required"],
  },
  transferredAt: {
    type: Date,
    default: Date.now,
    required: true,
  },
  notes: {
    type: String,
    trim: true,
  },
  previousHandler: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  reason: {
    type: String,
    trim: true,
  },
  location: {
    type: String,
    trim: true,
  },
  ipAddress: String,
  userAgent: String,
  transactionHash: String, // Blockchain transaction hash
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

chainOfCustodySchema.index({ evidenceId: 1, transferredAt: -1 });
chainOfCustodySchema.index({ handler: 1 });
chainOfCustodySchema.index({ action: 1 });

chainOfCustodySchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

export default mongoose.model("ChainOfCustody", chainOfCustodySchema);
