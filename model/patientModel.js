const { Schema, model } = require("mongoose");

const clientSchema = new Schema(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    idNumber: { type: String },
    phone: { type: String, required: true },
    address: { type: String, required: true, default: "Namangan viloyati" },
    year: { type: String, required: true },
    treating: { type: Boolean, default: false },
    debtor: { type: Boolean, default: false },
    gender: { type: String },

    // BMI uchun ustunlar
    height: { type: Number }, // balandlik (sm)
    weight: { type: Number }, // vazn (kg)
    bmi: { type: Number }, // hisoblangan BMI (ixtiyoriy)

    // Qon guruhi uchun ustun
    bloodGroup: { type: String }, // masalan: "A+", "B-", "O+", "AB-"
  },
  { timestamps: true }
);
// BMI ni avtomatik hisoblash middleware
clientSchema.pre("save", function (next) {
  if (this.height && this.weight) {
    const heightInMeters = this.height / 100;
    this.bmi = +(this.weight / (heightInMeters * heightInMeters)).toFixed(2); // 2 xonali
  }
  next();
});
const PatientModel = model("patients", clientSchema);
module.exports = PatientModel;
