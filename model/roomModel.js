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
    // Har bir joy holatini alohida ko'rsatish
    beds: {
      type: [
        {
          status: {
            type: String,
            enum: ["bo'sh", "band", "toza emas", "toza"],
            default: "bo'sh",
          },
          comment: {
            type: String,
            default: "",
          },
        },
      ],
      default: [],
    },
    nurse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admins", // User modeldan foydalansangiz
    },
    cleaner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admins", // User modeldan foydalansangiz
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
      enum: ["luxury", "standard", "econom"],
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
