const mongoose = require("mongoose");

const choosedRoomServicesSchema = new mongoose.Schema(
  {
    roomStoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomStory",
      required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    services: [
      {
        serviceId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RoomServices",
          required: true,
        },
        part: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        dailyTracking: [
          {
            type: Date, // muolaja berilgan sana
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "ChoosedRoomServices",
  choosedRoomServicesSchema
);
