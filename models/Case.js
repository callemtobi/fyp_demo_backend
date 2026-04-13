import mongoose from "mongoose";

const caseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    // type: mongoose.Schema.Types.ObjectId,
    // required: true,
    unique: true,
  },
  title: {
    type: String,
    required: [true, "Case title is required"],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Case description is required"],
    trim: true,
  },
  caseType: {
    type: String,
    enum: ["criminal", "civil", "corporate", "cyber", "other"],
    required: true,
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "closed", "archived"],
    default: "open",
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  leadInvestigator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  assignedInvestigators: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  evidence: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evidence",
    },
  ],
  relatedCases: [
    {
      caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Case",
      },
      relationshipType: {
        type: String,
        enum: ["similar", "linked", "duplicate", "parent", "child"],
      },
      notes: String,
    },
  ],
  timeline: [
    {
      event: String,
      date: Date,
      description: String,
      recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  tags: [
    {
      type: String,
      trim: true,
    },
  ],
  metadata: {
    location: String,
    jurisdiction: String,
    incidentDate: Date,
    reportedDate: Date,
    closedDate: Date,
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
caseSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  // next();
});

// Generate unique case number
caseSchema.pre("validate", async function (next) {
  if (!this.caseNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.caseNumber = `CASE-${year}-${String(count + 1).padStart(5, "0")}`;
  }
  // next();
});

export default mongoose.model("Case", caseSchema);
