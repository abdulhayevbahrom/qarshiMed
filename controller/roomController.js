const Room = require("../model/roomModel");
const response = require("../utils/response");
const RoomStory = require("../model/roomStoryModel");
const moment = require("moment");
const Expense = require("../model/expenseModel");
const mongoose = require("mongoose");

class RoomController {
  async createRoom(req, res) {
    try {
      const roomNumber = req.body.roomNumber;
      const exist_room = await Room.findOne({ roomNumber });
      if (exist_room) {
        return response.error(res, "Xona raqami band");
      }
      const room = await Room.create(req.body);
      if (!room) return response.notFound(res, "Xona yaratilmadi");
      return response.success(res, "Xona yaratildi", room);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Barcha xonalarni olish
  async getRooms(req, res) {
    try {
      const rooms = await Room.find().populate({
        path: "capacity",
        populate: [{ path: "patientId" }, { path: "doctorId" }],
      });
      if (!rooms.length) return response.notFound(res, "Xonalar topilmadi");
      return response.success(res, "Xonalar ro'yxati", rooms);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Xonani ID bo'yicha olish
  async getRoomById(req, res) {
    try {
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return response.error(res, "Xona _id si noto'g'ri yuborildi");
      }

      const room = await Room.findById(req.params.id).populate({
        path: "capacity",
        populate: [
          { path: "patientId", model: "patients" },
          { path: "roomId", model: "Room" },
          { path: "doctorId", model: "Admins" },
        ],
      });

      if (!room) {
        return response.notFound(res, "Xona topilmadi");
      }

      // Debug: Check if population worked
      if (room.capacity.length > 0) {
        room.capacity.forEach((story, index) => {
          if (!story.patientId || !story.patientId._id) {
            console.error(`Population failed for patientId in capacity ${index}`);
          }
          if (!story.roomId || !story.roomId._id) {
            console.error(`Population failed for roomId in capacity ${index}`);
          }
          if (story.doctorId && !story.doctorId._id) {
            console.error(`Population failed for doctorId in capacity ${index}`);
          }
        });
      }

      return response.success(res, "Xona topildi", room);
    } catch (err) {
      console.error("Error in getRoomById:", err);
      return response.serverError(res, err.message, err);
    }
  }

  // Xonani yangilash
  async updateRoom(req, res) {
    try {
      const room = await Room.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
      });
      if (!room) return response.error(res, "Xona yangilanmadi");
      return response.success(res, "Xona yangilandi", room);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Xonani o'chirish
  async deleteRoom(req, res) {
    try {
      const room = await Room.findByIdAndDelete(req.params.id);
      if (!room) return response.notFound(res, "Xona topilmadi");
      return response.success(res, "Xona o'chirildi", room);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  //   closeRoom change !closeRoom
  async closeRoom(req, res) {
    try {
      const room = await Room.findById(req.params.id);
      if (!room) return response.notFound(res, "Xona topilmadi");

      room.closeRoom = !room.closeRoom;
      await room.save();

      return response.success(res, "Xona yangilandi", room);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }


  async addPatientToRoom(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { patientId, treatingDays, doctorId } = req.body;
      if (!patientId) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Bemor _id si kiritilmagan");
      }
      if (!treatingDays || treatingDays < 1) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Davolanish kunini belgilang");
      }
      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Bemor _id si noto'g'ri yuborildi");
      }

      // Check if patient, room, and doctor exist
      const patient = await mongoose.model("patients").findById(patientId).session(session);
      const room = await Room.findById(req.params.id).session(session);
      const doctor = doctorId ? await mongoose.model("Admins").findById(doctorId).session(session) : null;

      if (!patient) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Bemor topilmadi");
      }
      if (!room) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Xona topilmadi");
      }
      if (doctorId && !doctor) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Doktor topilmadi");
      }

      // Check if patient is already in another active room
      const existsInOtherRoomStory = await RoomStory.findOne({
        patientId,
        active: true,
        roomId: { $ne: req.params.id },
      }).session(session);
      if (existsInOtherRoomStory) {
        await session.abortTransaction();
        session.endSession();
        return response.error(
          res,
          `Bu bemor boshqa xonada faol: ${existsInOtherRoomStory.roomId}`
        );
      }

      // Check room capacity
      if (room.capacity.length >= room.usersNumber) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Xonada bo'sh joy yo'q");
      }

      // Create paidDays array
      const paidDays = [];
      const today = moment();
      for (let i = 0; i < treatingDays; i++) {
        paidDays.push({
          day: i + 1,
          date: today.clone().add(i, "days").format("DD.MM.YYYY"),
          price: 0,
          isPaid: false,
        });
      }

      // Create RoomStory
      const [roomStory] = await RoomStory.create(
        [
          {
            patientId,
            roomId: room._id,
            doctorId,
            startDay: today.format("DD.MM.YYYY HH:mm"),
            paidDays,
            payments: [],
            active: true,
          },
        ],
        { session }
      );

      // Add roomStory._id to room capacity
      room.capacity.push(roomStory._id);
      await room.save({ session });

      // Populate the RoomStory
      const populatedRoomStory = await RoomStory.findById(roomStory._id)
        .populate("patientId")
        .populate("roomId")
        .populate("doctorId")
        .session(session);

      if (!populatedRoomStory.patientId || !populatedRoomStory.roomId) {
        console.error("Population failed:", {
          patientId: populatedRoomStory.patientId,
          roomId: populatedRoomStory.roomId,
          doctorId: populatedRoomStory.doctorId,
        });
      }

      await session.commitTransaction();
      session.endSession();

      return response.success(
        res,
        "Bemor xonaga biriktirildi",
        {
          room,
          roomStory: populatedRoomStory,
        }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("Error in addPatientToRoom:", err);
      return response.serverError(res, err.message, err);
    }
  }



  // Get Room Stories
  async getRoomStories(req, res) {
    try {
      let filter = {};
      if (req.query.roomId) {
        if (!mongoose.Types.ObjectId.isValid(req.query.roomId)) {
          return response.error(res, "Xona _id si noto'g'ri yuborildi");
        }
        filter.roomId = req.query.roomId;
      }

      const stories = await RoomStory.find(filter)
        .populate({ path: "patientId", model: "patients" })
        .populate({ path: "roomId", model: "Room" })
        .populate({ path: "doctorId", model: "Admins" })
        .sort({ createdAt: -1 });

      if (!stories.length) {
        return response.notFound(res, "Room story topilmadi");
      }

      // Debug: Check if population worked
      stories.forEach((story, index) => {
        if (!story.patientId || !story.patientId._id) {
          console.error(`Population failed for patientId in story ${index}`);
        }
        if (!story.roomId || !story.roomId._id) {
          console.error(`Population failed for roomId in story ${index}`);
        }
        if (story.doctorId && !story.doctorId._id) {
          console.error(`Population failed for doctorId in story ${index}`);
        }
      });

      return response.success(res, "Room storylar ro'yxati", stories);
    } catch (err) {
      console.error("Error in getRoomStories:", err);
      return response.serverError(res, err.message, err);
    }
  }


  async removePatientFromRoom(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { patientId } = req.body;
      const { id: roomId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(patientId)) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Bemor ID noto‘g‘ri");
      }

      const room = await Room.findById(roomId).session(session);

      if (!room) {
        await session.abortTransaction();
        session.endSession();
        return response.notFound(res, "Xona topilmadi");
      }

      if (!room.capacity.includes(patientId)) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Bemor ushbu xonada emas");
      }

      // RoomStory ni topamiz va yangilaymiz
      const activeStory = await RoomStory.findOne({
        roomId,
        _id: patientId,
        active: true,
      }).session(session);

      if (!activeStory) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Faol RoomStory topilmadi");
      }

      activeStory.active = false;
      activeStory.endDay = require("moment")().format("DD.MM.YYYY HH:mm");
      await activeStory.save({ session });

      // Bemorni xonadan o‘chiramiz
      room.capacity = room.capacity.filter((id) => id.toString() !== patientId);
      await room.save({ session });

      await session.commitTransaction();
      session.endSession();

      return response.success(res, "Bemor honadan chiqarildi", {
        room,
        updatedStory: activeStory,
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(res, err.message, err);
    }
  }

  async payForRoom(req, res) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { patientId, amount, paymentType } = req.body;
      if (!patientId || !amount)
        return response.error(res, "Bemor ID va to'lov summasi kerak");

      const roomStory = await RoomStory.findOne({
        patientId,
        active: true,
      }).session(session);

      if (!roomStory) return response.notFound(res, "Faol RoomStory topilmadi");

      const room = await Room.findById(roomStory.roomId).session(session);
      if (!room) return response.notFound(res, "Xona topilmadi");

      let remainingAmount = amount;
      const pricePerDay = room.pricePerDay;

      // paidDaysni loop qilib to'lovni taqsimlash
      for (let day of roomStory.paidDays) {
        if (day.isPaid) continue;

        if (remainingAmount >= pricePerDay) {
          day.price = pricePerDay;
          day.isPaid = true;
          remainingAmount -= pricePerDay;
        } else if (remainingAmount > 0) {
          day.price = remainingAmount;
          day.isPaid = false;
          remainingAmount = 0;
          break;
        } else {
          break;
        }
      }

      // payments massiviga to'lovni qo‘shish
      roomStory.payments.push({
        amount,
        paymentType,
        date: new Date(),
      });

      await roomStory.save({ session });


      await Expense.create(
        [
          {
            name: "Xona to'lovi",
            amount,
            type: "kirim",
            category: "Xona to'lovi",
            paymentType,
            description: "Xona to'lovi relevantId ni room storydan olinadi",
            relevantIdL: roomStory._id,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();



      return response.success(res, "To'lov amalga oshirildi", roomStory);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new RoomController();
