const mongoose = require("mongoose");

const choosedRoomServicesSchema = new mongoose.Schema(
  {
    roomStoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RoomStory",
      default: null,
      // required: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "stories",
      required: true,
    },
    services: [
      {
        workerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Admins",
        },
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
            date: {
              type: Date,
              required: true,
            },
            workerId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "Admins",
              required: true,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const ChoosedRoomServices = mongoose.model(
  "ChoosedRoomServices",
  choosedRoomServicesSchema
);

module.exports = ChoosedRoomServices;
