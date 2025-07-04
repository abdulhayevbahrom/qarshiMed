
// 2. Yangilangan Controller (roomServicesController.js)
const ChoosedRoomServices = require("../model/choosedRoomServices");
const response = require("../utils/response");
const roomStoryModel = require("../model/roomStoryModel");

class RoomServicesController {
  // ✅ 1. Bemor uchun muolajalarni biriktirish
  async assignRoomServices(req, res) {
    const mongoose = require("mongoose");
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const { roomStoryId } = req.body;

      const newAssignment = await ChoosedRoomServices.create([req.body], {
        session,
      });

      if (!newAssignment || !newAssignment[0]) {
        await session.abortTransaction();
        session.endSession();
        return response.notFound(res, "Muolajalar biriktirilmadi");
      }

      await roomStoryModel.findByIdAndUpdate(
        roomStoryId,
        { choosedRoomServices: newAssignment[0]._id },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      return response.success(res, "Muolajalar biriktirildi", newAssignment[0]);
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      return response.serverError(res, err.message, err);
    }
  }

  // ✅ 2. Bemorning ma'lumotlarini olish
  async getPatientServices(req, res) {
    try {
      const { patientId } = req.params;

      const data = await ChoosedRoomServices.findOne({
        roomStoryId: patientId,
      })
        // .populate("serviceId")
        .populate("services.serviceId", "name")
        .populate("services.dailyTracking.workerId", "firstName lastName role");
      if (!data) return response.notFound(res, "Ma'lumot topilmadi");

      return response.success(res, "Bemor muolajalari", data);
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }

  // ✅ 3. Muolajani o'sha kunga bajarildi deb belgilash yoki o'chirish
  async markTreatmentDone(req, res) {
    try {
      const { patientId, serviceId, date, workerId, action } = req.body;

      const choosed = await ChoosedRoomServices.findOne({
        roomStoryId: patientId,
      });

      if (!choosed)
        return response.notFound(
          res,
          "Bemorga biriktirilgan muolajalar topilmadi"
        );

      const service = choosed.services.find(
        (s) => s.serviceId.toString() === serviceId
      );

      if (!service)
        return response.notFound(res, "Ko'rsatilgan muolaja topilmadi");

      const targetDate = new Date(date);
      const existingIndex = service.dailyTracking.findIndex(
        (d) => new Date(d.date).toDateString() === targetDate.toDateString()
      );

      if (action === "remove") {
        // O'chirish
        if (existingIndex !== -1) {
          service.dailyTracking.splice(existingIndex, 1);
          await choosed.save();
          return response.success(res, "Muolaja belgilash o'chirildi", service);
        } else {
          return response.notFound(res, "O'chiriladigan muolaja topilmadi");
        }
      } else {
        // Qo'shish
        if (existingIndex === -1) {
          service.dailyTracking.push({
            date: targetDate,
            workerId: workerId,
          });
          await choosed.save();
          return response.success(res, "Muolaja kuni saqlandi", service);
        } else {
          return response.success(res, "Muolaja allaqachon belgilangan", service);
        }
      }
    } catch (err) {
      return response.serverError(res, err.message, err);
    }
  }
}

module.exports = new RoomServicesController;
