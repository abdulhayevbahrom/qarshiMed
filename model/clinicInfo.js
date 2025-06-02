const mongoose = require("mongoose");

const clinicInfoSchema = new mongoose.Schema({
  clinicName: {
    type: String,
    required: true,
  },
  startTime: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
  address: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  logo: {
    type: String,
  },
});

module.exports = mongoose.model("ClinicInfo", clinicInfoSchema);
