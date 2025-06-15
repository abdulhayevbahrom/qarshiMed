const { Schema, model, Types } = require("mongoose");

const storySchema = new Schema(
  {
    patientId: {
      type: Types.ObjectId,
      ref: "patients",
      required: true,
    },
    doctorId: {
      type: Types.ObjectId,
      ref: "Admins",
      required: true,
    },
    paymentType: {
      type: String,
      enum: ["karta", "naqt"],
      required: true,
    },
    payment_status: {
      type: Boolean,
      default: false,
    },
    payment_amount: {
      type: Number,
      required: true,
    },
    sickname: {
      type: String,
    },
    view: {
      type: Boolean,
      default: false,
    },
    order_number: {
      type: Number,
    },

    // Fayllar (rasm, hujjat va h.k.)
    files: [
      {
        filename: String,
        url: String, // faylga kirish uchun havola
      },
    ],

    // Retsept (davolash bo‘yicha yozuvlar)
    retsept: {
      diagnosis: { type: String },
      prescription: { type: String },
      recommendations: { type: String },
    },

    labaratoryResult: {
      type: Types.ObjectId,
      ref: "Labaratory",
    },

    startTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endTime: {
      type: Date,
    },

    services: [
      {
        name: { type: String, required: true },
        price: { type: Number, required: true },
      },
    ],

    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model("stories", storySchema);


//   diagnosis,
//   prescription,
//   recommendations,
//   uploadedFiles,
//   view: true,
//   endTime: ,