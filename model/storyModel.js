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
      // required: true,
    },
    payment_status: {
      type: Boolean,
      default: false,
    },
    payment_amount: {
      type: Number,
      // required: true,
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
      diagnosis: { type: String, trim: true },
      prescription: [
        {
          medicationName: { type: String, trim: true, required: true },
          dosagePerDay: { type: Number, min: 0 },
          durationDays: { type: Number, min: 0 },
          description: { type: String, trim: true },
          doseTracking: [
            {
              day: { type: Number, min: 1 }, // Day number (1 to durationDays)
              doseNumber: { type: Number, min: 1 }, // Dose number for that day (1 to dosagePerDay)
              taken: { type: Boolean, default: false },
              timestamp: { type: Date },
              workerId: {
                type: Types.ObjectId,
                ref: "Admins",
              },
            },
          ],
          _id: false,
        },
      ],
      recommendations: { type: String, trim: true },
    },

    labaratoryResult: {
      type: Types.ObjectId,
      ref: "Labaratory",
    },

    startTime: {
      type: Date,
      // default: Date.now,
      // required: true,
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
    redirectStatus: {
      type: Boolean,
      default: false,
    },
    // bu yotib davolanmaydigan bemorlar uchun qo‘shiladi
    // agar yotib davolansa choosedRoomServices ga qo‘shiladi
    // reabilitationServices: [
    //   {
    //     serviceId: {
    //       type: Types.ObjectId,
    //       ref: "RoomServices",
    //       required: true,
    //     },
    //     part: {
    //       type: String,
    //       required: true,
    //     },
    //     quantity: {
    //       type: Number,
    //       required: true,
    //       min: 1,
    //     },
    //   },
    // ],
  },
  {
    timestamps: true,
  }
);

module.exports = model("stories", storySchema);
