import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Case",
    required: true,
  },
  fileName: {
    type: String,
    required: true,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Report = mongoose.model("Report", reportSchema);

export default Report;
