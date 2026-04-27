import mongoose from "mongoose";

const caseSchema = new mongoose.Schema({
  caseNumber: {
    type: String,
    unique: true,
    required: [true, "Case number is required"],
  },
  caseType: {
    type: String,
    enum: ["criminal", "civil", "corporate", "cyber", "other"],
    default: "other",
  },
  status: {
    type: String,
    enum: ["open", "in-progress", "closed", "archived", "suspended"],
    default: "open",
  },
  jurisdiction: {
    type: String,
    required: [true, "Jurisdiction is required"],
    trim: true,
  },
  dateOpened: {
    type: Date,
    default: Date.now,
    required: true,
  },
  assignedOfficer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Allow the case to exist without always being assigned on creation
  },

  // Additional Case Details
  title: {
    type: String,
    required: [true, "Case title is required"],
    trim: true,
  },
  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true,
  },

  // Optional case details from create-case frontend
  crime: {
    offenseType: String,
    classification: {
      type: String,
      enum: ["misdemeanor", "felony", "infraction", "other"],
      default: "misdemeanor",
    },
    location: String,
    occurredAt: Date,
  },
  victim: {
    fullName: String,
    contact: {
      phone: String,
      email: String,
    },
    statement: String,
    injuryDescription: String,
  },
  witness: {
    fullName: String,
    contact: {
      phone: String,
      email: String,
    },
    testimony: String,
  },
  suspect: {
    fullName: String,
    status: {
      type: String,
      enum: ["person_of_interest", "suspect", "arrested", "charged", "cleared"],
      default: "person_of_interest",
    },
    alibi: String,
    contact: {
      phone: String,
      email: String,
    },
  },

  // Evidence is linked later from upload flow
  evidence: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Evidence",
    },
  ],
  metadata: {
    location: String,
    incidentDate: Date,
    closedDate: Date,
    notes: String,
  },

  // Timeline
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

  // AI Analysis Summary
  caseAnalysisSummary: {
    caseSummary: {
      type: String,
      default: null,
    },
    evidenceSummary: {
      type: String,
      default: null,
    },
    lastUpdated: {
      type: Date,
      default: null,
    },
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for common queries
// caseSchema.index({ caseNumber: 1 });
caseSchema.index({ status: 1 });
caseSchema.index({ jurisdiction: 1 });
caseSchema.index({ dateOpened: -1 });
caseSchema.index({ assignedOfficer: 1 });
caseSchema.index({ caseType: 1 });

// Update the updatedAt timestamp before saving
caseSchema.pre("save", function () {
  this.updatedAt = Date.now();
});

// Generate unique case number if not provided
caseSchema.pre("validate", async function () {
  if (!this.caseNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments();
    this.caseNumber = `CASE-${year}-${String(count + 1).padStart(5, "0")}`;
  }
});

export default mongoose.model("Case", caseSchema);
