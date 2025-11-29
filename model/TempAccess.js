const mongoose = require("mongoose");

const TempAccessSchema = new mongoose.Schema(
  {
    token: { type: String, unique: true, index: true },
    otpHash: { type: String },
    mobileNo: { type: String },
    email: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: { type: Date, index: true },
    used: { type: Boolean, default: false },
    meta: {},
  },
  { timestamps: true }
);

module.exports = mongoose.model("TempAccess", TempAccessSchema);
