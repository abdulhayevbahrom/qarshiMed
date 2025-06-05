const Room = require("../model/roomModel");
const response = require("../utils/response");
const RoomStory = require("../model/roomStoryModel");
const mongoose = require("mongoose");
class RoomController {
  async createRoom(req, res) {
    try {
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
      const rooms = await Room.find();
      // .populate("capacity");
      if (!rooms.length) return response.notFound(res, "Xonalar topilmadi");
      return response.success(res, "Xonalar ro'yxati", rooms);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // Xonani ID bo'yicha olish
  async getRoomById(req, res) {
    try {
      const room = await Room.findById(req.params.id).populate("capacity");
      if (!room) return response.notFound(res, "Xona topilmadi");
      return response.success(res, "Xona topildi", room);
    } catch (err) {
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
      const { patientId, treatingDays } = req.body;
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

      // Boshqa xonalarda ham bor-yo‘qligini tekshirish
      const existsInOtherRoom = await Room.findOne({
        capacity: patientId,
        _id: { $ne: req.params.id },
      }).session(session);
      if (existsInOtherRoom) {
        await session.abortTransaction();
        session.endSession();
        return response.error(
          res,
          `Bu bemor ${existsInOtherRoom.roomNumber}-xonada mavjud`
        );
      }

      const room = await Room.findById(req.params.id).session(session);
      if (!room) {
        await session.abortTransaction();
        session.endSession();
        return response.notFound(res, "Xona topilmadi");
      }

      if (room.capacity.includes(patientId)) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Bu bemor allaqachon ushbu honada");
      }

      if (room.capacity.length >= room.usersNumber) {
        await session.abortTransaction();
        session.endSession();
        return response.error(res, "Xonada bo'sh joy yo'q");
      }

      // 1. Bemorni capacity ga qo'shish
      room.capacity.push(patientId);
      await room.save({ session });

      // 2. paidDays massivini avtomatik yaratish
      const paidDays = [];
      const today = require("moment")();
      for (let i = 0; i < treatingDays; i++) {
        paidDays.push({
          day: i + 1,
          date: today.clone().add(i, "days").format("DD.MM.YYYY"),
          price: 0,
          isPaid: false,
        });
      }

      // 3. RoomStory ochish
      const roomStory = await RoomStory.create(
        [
          {
            patientId,
            roomId: room._id,
            startDay: today.format("DD.MM.YYYY HH:mm"),
            paidDays,
            payments: [],
            active: true,
          },
        ],
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return response.success(
        res,
        "Bemor xonaga biriktirildi va roomStory yaratildi",
        {
          room,
          roomStory: roomStory[0],
        }
      );
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(res, err.message, err);
    }
  }

  async getRoomStories(req, res) {
    try {
      let filter = {};
      if (req.query.roomId) {
        filter.roomId = req.query.roomId;
      }
      const stories = await RoomStory.find(filter)
        .populate("patientId")
        .populate("roomId")
        .sort({ createdAt: -1 });

      if (!stories.length)
        return response.notFound(res, "Room story topilmadi");
      return response.success(res, "Room storylar ro'yxati", stories);
    } catch (err) {
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
        patientId,
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
      const { patientId, amount } = req.body;
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
        date: new Date(),
      });

      await roomStory.save({ session });

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
