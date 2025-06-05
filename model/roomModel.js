const { default: def } = require("ajv/dist/vocabularies/discriminator");
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomNumber: {
      type: Number,
      required: true,
      unique: true,
    },
    floor: {
      type: Number,
      required: true,
    },
    usersNumber: {
      type: Number,
      required: true,
    },
    capacity: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "RoomStory",
        },
      ],
      default: [],
    },
    pricePerDay: {
      type: Number,
      required: true,
    },
    category: {
      type: String,
      enum: ["luxury", "standard", "econom"], // kerakli turlarni qo'shing
      required: true,
    },
    closeRoom: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Room", roomSchema);
