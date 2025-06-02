const mongoose = require("mongoose");
const AdminSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    login: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    role: {
      type: String,
      default: "admin",
      enum: ["reception", "director", "doctor"],
    },
    permissions: {
      type: [String],
      default: [],
    },
    salary_per_month: {
      type: Number,
      default: 0,
    },
    specialization: {
      type: String,
      default: "",
    },
    phone: {
      type: String,
      required: true,
    },
    admission_price: {
      type: Number,
      default: 0,
    },
    birthday: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admins", AdminSchema);
